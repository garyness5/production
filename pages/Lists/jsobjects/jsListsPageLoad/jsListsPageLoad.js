export default {
	async load() {
		await storeValue("listsPageReady", false);

		try {
			const initialized = await jsAppInit.init();

			if (!initialized) {
				return false;
			}

			const result = await apiGetHelperLists.run();

			if (
				result?.ok !== true ||
				!Array.isArray(result.lists)
			) {
				throw new Error("Helper Lists could not be loaded.");
			}

			await storeValue("listsPageReady", true);
			return true;

		} catch (error) {
			await storeValue("listsPageReady", false);
			console.error("Lists initialization failed:", error);
			jsUserErrors.show(
				error,
				"Unable to load Lists data."
			);
			return false;
		}
	},

	isReady() {
		return appsmith.store.listsPageReady === true;
	}
};
