import {
  combineLatest,
  distinctUntilChanged,
  firstValueFrom,
  map,
  mergeWith,
  NEVER,
  Observable,
  of,
  ReplaySubject,
  share,
  Subject,
  switchMap,
  tap,
  timer,
} from "rxjs";
import { SemVer } from "semver";

import { ServerCommunicationConfig } from "@bitwarden/sdk-internal";

import { AuthService } from "../../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../../auth/enums/authentication-status";
import {
  AllowedFeatureFlagTypes,
  FeatureFlag,
  FeatureFlagValueType,
  getFeatureFlagValue,
} from "../../../enums/feature-flag.enum";
import { UserId } from "../../../types/guid";
import { ConfigApiServiceAbstraction } from "../../abstractions/config/config-api.service.abstraction";
import { ConfigService } from "../../abstractions/config/config.service";
import { ServerConfig } from "../../abstractions/config/server-config";
import { Environment, EnvironmentService, Region } from "../../abstractions/environment.service";
import { LogService } from "../../abstractions/log.service";
import { SdkService } from "../../abstractions/sdk/sdk.service";
import { devFlagEnabled, devFlagValue } from "../../misc/flags";
import { ServerConfigData } from "../../models/data/server-config.data";
import { ServerSettings } from "../../models/domain/server-settings";
import { ServerConfigResponse } from "../../models/response/server-config.response";
import { CONFIG_DISK, KeyDefinition, StateProvider, UserKeyDefinition } from "../../state";

export const RETRIEVAL_INTERVAL = devFlagEnabled("configRetrievalIntervalMs")
  ? (devFlagValue("configRetrievalIntervalMs") as number)
  : 48 * 60 * 60 * 1000; // 48 hours

export const SLOW_EMISSION_GUARD = 800;

export type ApiUrl = string;

export const USER_SERVER_CONFIG = new UserKeyDefinition<ServerConfig>(CONFIG_DISK, "serverConfig", {
  deserializer: (data) => (data == null ? null : ServerConfig.fromJSON(data)),
  clearOn: ["logout"],
});

export const GLOBAL_SERVER_CONFIGURATIONS = KeyDefinition.record<ServerConfig, ApiUrl>(
  CONFIG_DISK,
  "byServer",
  {
    deserializer: (data) => (data == null ? null : ServerConfig.fromJSON(data)),
  },
);

export const GLOBAL_FEATURE_FLAG_OVERRIDES = KeyDefinition.record<
  AllowedFeatureFlagTypes,
  FeatureFlag
>(CONFIG_DISK, "featureFlagOverrides", {
  deserializer: (data) => data,
});

/** The SDK only takes boolean flags. Nullable so an absent config passes straight through. */
export function toSdkFeatureFlags(config: ServerConfig | null): Map<string, boolean> {
  return new Map(
    Object.entries(config?.featureStates ?? {})
      .filter(([, value]) => typeof value === "boolean")
      .map(([key, value]) => [key, value] as [string, boolean]),
  );
}

const environmentComparer = (previous: Environment, current: Environment) => {
  return previous.getApiUrl() === current.getApiUrl();
};

type ConfigContext = readonly [
  existingConfig: ServerConfig | null,
  userId: UserId | null,
  environment: Environment,
  fallbackConfig: ServerConfig | null,
];

// FIXME: currently we are limited to api requests for active users. Update to accept a UserId and APIUrl once ApiService supports it.
export class DefaultConfigService implements ConfigService {
  private failedFetchFallbackSubject = new Subject<ServerConfig | null>();
  private serverCommunicationConfigSubject = new ReplaySubject<ServerCommunicationConfig>(1);
  private configContext$: Observable<ConfigContext>;
  private configRefreshes = new Map<string, Promise<void>>();

  serverConfig$: Observable<ServerConfig | null>;
  serverCommunicationConfig$ = this.serverCommunicationConfigSubject.asObservable();

  serverSettings$: Observable<ServerSettings>;

  cloudRegion$: Observable<Region>;

  private featureFlagOverrides$: Observable<Partial<
    Record<FeatureFlag, AllowedFeatureFlagTypes>
  > | null>;

  constructor(
    private configApiService: ConfigApiServiceAbstraction,
    private environmentService: EnvironmentService,
    private logService: LogService,
    private stateProvider: StateProvider,
    private authService: AuthService,
    private sdkService: SdkService,
    private options: { cacheFirst?: boolean } = {},
  ) {
    const globalConfig$ = this.environmentService.globalEnvironment$.pipe(
      distinctUntilChanged(environmentComparer),
      switchMap((environment) =>
        this.globalConfigFor$(environment.getApiUrl()).pipe(
          map((config) => {
            return [config, null as UserId | null, environment, config] as const;
          }),
        ),
      ),
    );

    this.configContext$ = this.stateProvider.activeUserId$.pipe(
      distinctUntilChanged(),
      switchMap((userId) => {
        if (userId == null) {
          // Global
          return globalConfig$;
        }

        return this.authService.authStatusFor$(userId).pipe(
          map((authStatus) => authStatus === AuthenticationStatus.Unlocked),
          distinctUntilChanged(),
          switchMap((isUnlocked) => {
            if (!isUnlocked) {
              return globalConfig$;
            }

            return combineLatest([
              this.environmentService
                .getEnvironment$(userId)
                .pipe(distinctUntilChanged(environmentComparer)),
              this.userConfigFor$(userId),
            ]).pipe(
              switchMap(([environment, config]) => {
                if (config == null) {
                  // If the user doesn't have any config yet, use the global config for that url as the fallback
                  return this.globalConfigFor$(environment.getApiUrl()).pipe(
                    map(
                      (globalConfig) =>
                        [null as ServerConfig | null, userId, environment, globalConfig] as const,
                    ),
                  );
                }

                return of([config, userId, environment, config] as const);
              }),
            );
          }),
        );
      }),
    );

    this.serverConfig$ = this.configContext$.pipe(
      tap(async (rec) => {
        const [existingConfig, userId, environment, fallbackConfig] = rec;
        // Grab new config if older retrieval interval
        if (!existingConfig || this.olderThanRetrievalInterval(existingConfig.utcDate)) {
          await this.renewConfig(existingConfig, userId, environment, fallbackConfig);
        }
      }),
      switchMap(([existingConfig, , , fallbackConfig]) => {
        // Browser startup can use stored settings while the refresh runs,
        // including when the server is unreachable.
        if (this.options.cacheFirst) {
          return of(fallbackConfig);
        }
        // If we needed to fetch, stop this emit, we'll get a new one after update
        // This is split up with the above tap because we need to return an observable from a failed promise,
        // which isn't very doable since promises are converted to observables in switchMap
        if (!existingConfig || this.olderThanRetrievalInterval(existingConfig.utcDate)) {
          return NEVER;
        }
        return of(existingConfig);
      }),
      tap((config) => void this.gateLogRecorder(config)),
      // If fetch fails, we'll emit on this subject to fallback to the existing config
      mergeWith(this.failedFetchFallbackSubject),
      share({ connector: () => new ReplaySubject(1), resetOnRefCountZero: () => timer(1000) }),
    );

    this.cloudRegion$ = this.serverConfig$.pipe(
      map((config) => config?.environment?.cloudRegion ?? Region.US),
    );

    this.serverSettings$ = this.serverConfig$.pipe(
      map((config) => config?.settings ?? new ServerSettings()),
    );

    this.featureFlagOverrides$ = this.stateProvider.getGlobal(GLOBAL_FEATURE_FLAG_OVERRIDES).state$;
  }

  getFeatureFlag$<Flag extends FeatureFlag>(key: Flag) {
    return combineLatest([this.serverConfig$, this.featureFlagOverrides$]).pipe(
      map(([serverConfig, overrides]) => this.resolveFlag(serverConfig, overrides, key)),
      // Config refreshes re-emit unchanged flags; consumers would restart their work each time.
      distinctUntilChanged(),
    );
  }

  userCachedFeatureFlag$<Flag extends FeatureFlag>(key: Flag, userId: UserId) {
    return combineLatest([
      this.stateProvider.getUser(userId, USER_SERVER_CONFIG).state$,
      this.featureFlagOverrides$,
    ]).pipe(map(([config, overrides]) => this.resolveFlag(config, overrides, key)));
  }

  async getFeatureFlag<Flag extends FeatureFlag>(key: Flag) {
    return await firstValueFrom(this.getFeatureFlag$(key));
  }

  private resolveFlag<Flag extends FeatureFlag>(
    serverConfig: ServerConfig | null,
    overrides: Partial<Record<FeatureFlag, AllowedFeatureFlagTypes>> | null,
    key: Flag,
  ): FeatureFlagValueType<Flag> {
    if (overrides != null && overrides[key] != null) {
      return overrides[key] as FeatureFlagValueType<Flag>;
    }
    return getFeatureFlagValue(serverConfig, key);
  }

  checkServerMeetsVersionRequirement$(minimumRequiredServerVersion: SemVer) {
    return this.serverConfig$.pipe(
      map((serverConfig) => {
        if (serverConfig == null) {
          return false;
        }
        const serverVersion = new SemVer(serverConfig.version);
        return serverVersion.compare(minimumRequiredServerVersion) >= 0;
      }),
    );
  }

  async ensureConfigFetched() {
    // Trigger retrieval if needed. Cache-first clients can continue using stored
    // settings while that retrieval completes in the background.
    await firstValueFrom(this.serverConfig$);
  }

  async refreshConfig(): Promise<void> {
    const [existingConfig, userId, environment, fallbackConfig] = await firstValueFrom(
      this.configContext$,
    );
    await this.renewConfig(existingConfig, userId, environment, fallbackConfig);
  }

  private olderThanRetrievalInterval(date: Date) {
    return new Date().getTime() - date.getTime() > RETRIEVAL_INTERVAL;
  }

  /**
   * Pushes the flight recorder flag to `LogService`. `LogService` can't depend on this
   * service without a cycle, since this service depends on it.
   * Remove with `PM30935_FlightRecorderTsLogging`.
   */
  private async gateLogRecorder(serverConfig: ServerConfig | null): Promise<void> {
    try {
      const overrides = await firstValueFrom(this.featureFlagOverrides$);
      this.logService.enableRecorder(
        this.resolveFlag(serverConfig, overrides, FeatureFlag.PM30935_FlightRecorderTsLogging),
      );
    } catch {
      // Never let log plumbing break the config pipeline.
    }
  }

  private renewConfig(
    existingConfig: ServerConfig | null,
    userId: UserId | null,
    environment: Environment,
    fallbackConfig: ServerConfig | null,
  ): Promise<void> {
    // Pane open/focus and an expired cache can request the same refresh together.
    // Keep those callers on one request, scoped to the account and server.
    const key = JSON.stringify([userId, environment.getApiUrl()]);
    const pending = this.configRefreshes.get(key);
    if (pending != null) {
      return pending;
    }
    const request = this.fetchConfig(existingConfig, userId, environment, fallbackConfig).finally(
      () => this.configRefreshes.delete(key),
    );
    this.configRefreshes.set(key, request);
    return request;
  }

  // Updates the on-disk configuration with a newly retrieved configuration.
  private async fetchConfig(
    existingConfig: ServerConfig | null,
    userId: UserId | null,
    environment: Environment,
    fallbackConfig: ServerConfig | null,
  ): Promise<void> {
    // Cache-first consumers already received this value. Do not emit it again
    // after a failure: the active account/environment may have changed meanwhile.
    const emitFallback = () => {
      if (!this.options.cacheFirst) {
        this.failedFetchFallbackSubject.next(fallbackConfig);
      }
    };
    let handle: ReturnType<typeof setTimeout> | undefined;
    try {
      // Feature flags often have a big impact on user experience, lets ensure we return some value
      // somewhat quickly even though it may not be accurate, we won't cancel the HTTP request
      // though so that hopefully it can have finished and hydrated a more accurate value.
      if (!this.options.cacheFirst) {
        handle = setTimeout(() => {
          this.logService.info("Environment did not respond in time, emitting previous config.");
          emitFallback();
        }, SLOW_EMISSION_GUARD);
      }
      const response = await this.configApiService.get(userId);
      clearTimeout(handle);
      const newConfig = new ServerConfig(new ServerConfigData(response));

      this.parseBootstrapConfig(response);

      // Update the environment region
      if (
        newConfig?.environment?.cloudRegion != null &&
        existingConfig?.environment?.cloudRegion != newConfig.environment.cloudRegion
      ) {
        // Null userId sets global, otherwise sets to the given user
        await this.environmentService.setCloudRegion(userId, newConfig?.environment?.cloudRegion);
      }

      if (userId == null) {
        // update global state with new pulled config
        await this.stateProvider.getGlobal(GLOBAL_SERVER_CONFIGURATIONS).update((configs) => {
          return { ...configs, [environment.getApiUrl()]: newConfig };
        });
      } else {
        // The SDK client must hold the new flags before anything observing the stored config reacts.
        await this.sdkService.setFlags(userId, toSdkFeatureFlags(newConfig));
        // update state with new pulled config
        await this.stateProvider.setUserState(USER_SERVER_CONFIG, newConfig, userId);
      }
    } catch (e) {
      // mutate error to be handled by catchError
      this.logService.error(`Unable to fetch ServerConfig from ${environment.getApiUrl()}`, e);
      // Emit the existing config
      emitFallback();
    } finally {
      clearTimeout(handle);
    }
  }

  private globalConfigFor$(apiUrl: string): Observable<ServerConfig | null> {
    return this.stateProvider
      .getGlobal(GLOBAL_SERVER_CONFIGURATIONS)
      .state$.pipe(map((configs) => configs?.[apiUrl] ?? null));
  }

  private userConfigFor$(userId: UserId): Observable<ServerConfig | null> {
    return this.stateProvider.getUser(userId, USER_SERVER_CONFIG).state$;
  }

  private parseBootstrapConfig(response: ServerConfigResponse) {
    const bootstrap = response.communication?.bootstrap ?? null;
    const vaultUrl = response.environment?.vault;

    // Emit communication config so subscribers (e.g. ServerCommunicationConfigService) can persist it
    const communicationConfig: ServerCommunicationConfig =
      bootstrap?.type === "ssoCookieVendor" && vaultUrl != null
        ? {
            bootstrap: {
              type: "ssoCookieVendor",
              idpLoginUrl: bootstrap.idpLoginUrl,
              cookieName: bootstrap.cookieName,
              cookieDomain: bootstrap.cookieDomain,
              vaultUrl: vaultUrl,
              cookieValue: undefined,
            },
          }
        : { bootstrap: { type: "direct" } };
    this.serverCommunicationConfigSubject.next(communicationConfig);
  }
}
