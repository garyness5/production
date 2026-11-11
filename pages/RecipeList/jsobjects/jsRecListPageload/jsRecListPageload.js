export default {
	async load() {
		await storeValue("recListPageReady", false);
		await removeValue("RecListBatchPending");

		try {
			const ok = await jsAppInit.init();

			if (!ok) {
				await storeValue("recListPageReady", false);
				return false;
			}

			const [recipesResult, categoriesResult] = await Promise.allSettled([
				apiRecLstGetRecipes.run(),
				apiRecLstGetCategories.run()
			]);

			if (
				recipesResult.status !== "fulfilled" ||
				recipesResult.value?.authenticated !== true ||
				!Array.isArray(recipesResult.value?.recipes)
			) {
				throw new Error("RecipeList records could not be loaded.");
			}

			const returningFromRecipe =
						appsmith.store.RecList_returning_from_recipe === true;

			await removeValue("RecList_returning_from_recipe");

			if (!returningFromRecipe) {
				const firstRecipeId = Number(
					recipesResult.value.recipes[0]?.id || 0
				);

				await storeValue(
					"RecList_selected_id",
					firstRecipeId > 0 ? firstRecipeId : null,
					false
				);
			}

			await storeValue("RecListConfirmedActive", {}, false);
			await storeValue("RecListStatusSaving", {}, false);

			if (
				categoriesResult.status !== "fulfilled" ||
				categoriesResult.value?.authenticated !== true ||
				!Array.isArray(categoriesResult.value?.categories)
			) {
				console.warn(
					"RecipeList: Category reference data unavailable.",
					categoriesResult
				);
			}

			await storeValue("recListPageReady", true);

			return true;

		} catch (error) {
			await storeValue("recListPageReady", false);

			console.error("RecipeList initialization failed:", error);

			showAlert(
				"Unable to load RecipeList data. Please try again.",
				"error"
			);

			return false;
		}
	}
};