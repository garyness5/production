export default {
	async load() {
		await storeValue("ingPageReady", false);

		try {
			const ok = await jsAppInit.init();
			if (!ok) return false;

			const results = await Promise.all([
				apiGetMyIngredients.run(),
				apiIngGetIngredientLookups.run()
			]);

			if (results.some(result => result?.authenticated !== true)) {
				throw new Error("Ingredients data request failed.");
			}

			const lookups = results[1];

			const required = [
				"helper_lists",
				"categories",
				"suppliers",
				"packaging",
				"allergens",
				"diet_tags",
				"units"
			];

			if (required.some(key => !Array.isArray(lookups[key]))) {
				throw new Error("Ingredients lookup response is incomplete.");
			}

			await storeValue("ingPageReady", true);
			return true;

		} catch (error) {
			await storeValue("ingPageReady", false);
			console.error("Ingredients initialization failed:", error);

			jsUserErrors.show(
				error,
				"Unable to load Ingredients data. Please try again."
			);

			return false;
		}
	},

	isReady() {
		return appsmith.store.ingPageReady === true;
	},
};