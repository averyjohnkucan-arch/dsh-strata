/** Optional shared GPU admission. The plugins remain independently installable. */
export function attachScheduler(ctx, service) {
  ctx.inject(["modelScheduler"], (scope) => {
    const scheduler = scope.get("modelScheduler");
    scope.effect(() => {
      service.scheduler = scheduler;
      const unregister = scheduler.registerProvider("strata", () =>
        service.profiles.map((profile) => service.driver(profile.id)),
      );
      service.changed();
      return async () => {
        unregister();
        // Detaching must not abort a live answer. Its lease covers checkpoint IO too.
        await service.requestTail;
        try {
          await Promise.all(
            service.profiles.map((profile) =>
              scheduler.unload("strata:" + profile.id),
            ),
          );
        } finally {
          if (service.scheduler === scheduler) service.scheduler = undefined;
          service.changed();
        }
      };
    });
  });
}
