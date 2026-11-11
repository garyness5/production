export default {
	selectedRecipeId() {
		return Number(
			tblRecipeList.selectedRow?.id || 0
		);
	},

	hasSelection() {
		return this.selectedRecipeId() > 0;
	},

	async addRecipe() {
		await storeValue(
			"current_recipe_id",
			0
		);

		await storeValue(
			"Recipe_mode",
			"add"
		);

		await removeValue(
			"Recipe_open_mode"
		);

		await removeValue(
			"recipe_workspace"
		);

		await removeValue(
			"recipe_baseline"
		);

		await removeValue(
			"rec_components_local_rows"
		);

		navigateTo(
			"Recipe",
			{},
			"SAME_WINDOW"
		);

		return true;
	},

	async editSelectedRecipe() {
		if (!this.hasSelection()) {
			showAlert(
				"Select a Recipe first.",
				"warning"
			);

			return false;
		}

		await storeValue(
			"current_recipe_id",
			this.selectedRecipeId()
		);

		await storeValue(
			"Recipe_mode",
			"edit"
		);

		await removeValue(
			"Recipe_open_mode"
		);

		await removeValue(
			"recipe_workspace"
		);

		await removeValue(
			"recipe_baseline"
		);

		await removeValue(
			"rec_components_local_rows"
		);

		navigateTo(
			"Recipe",
			{},
			"SAME_WINDOW"
		);

		return true;
	},

	async duplicateSelectedRecipe() {
		if (!this.hasSelection()) {
			showAlert(
				"Select a Recipe first.",
				"warning"
			);

			return false;
		}

		await removeValue(
			"recipe_workspace"
		);

		await removeValue(
			"recipe_baseline"
		);

		await removeValue(
			"rec_components_local_rows"
		);

		await removeValue(
			"Recipe_open_mode"
		);

		await storeValue(
			"current_recipe_id",
			this.selectedRecipeId()
		);

		await storeValue(
			"Recipe_mode",
			"duplicate"
		);

		navigateTo(
			"Recipe",
			{},
			"SAME_WINDOW"
		);

		return true;
	},

	async deleteSelectedRecipeStart() {
		if (!(await jsAuthSession.requireValid())) {
			return false;
		}

		if (!this.hasSelection()) {
			showAlert("Select a Recipe first.", "warning");
			return false;
		}

		const recipeId = this.selectedRecipeId();

		const row = (apiRecLstGetRecipes.data?.recipes || [])
		.find(r => Number(r.id) === recipeId);

		const revision = Number(
			appsmith.store.RecListConfirmedActive?.[String(recipeId)]?.revision
			?? row?.revision
		);

		if (!Number.isSafeInteger(revision) || revision < 1) {
			showAlert(
				"Recipe revision is unavailable. Refresh RecipeList.",
				"warning"
			);
			return false;
		}

		await storeValue("RecListDeleteTarget", {
			recipe_id: recipeId,
			expected_revision: revision
		}, false);

		try {
			const result = await apiRecLstGetImpactCount.run({
				recipe_id: recipeId
			});

			if (
				result?.authenticated !== true ||
				!result?.impact
			) {
				throw new Error("Unable to check Recipe impact.");
			}

			showModal(mdlRecLstDelete.name);
			return true;

		} catch (error) {
			await removeValue("RecListDeleteTarget");

			showAlert(
				"Unable to check Recipe impact. No changes were made.",
				"error"
			);
			return false;
		}
	},


	async deleteSelectedRecipeConfirm() {
		if (!(await jsAuthSession.requireValid())) {
			return false;
		}
		const target = appsmith.store.RecListDeleteTarget;

		const recipeId = Number(target?.recipe_id);
		const revision = Number(target?.expected_revision);

		if (
			!Number.isSafeInteger(recipeId) ||
			recipeId <= 0 ||
			!Number.isSafeInteger(revision) ||
			revision < 1
		) {
			showAlert(
				"Delete selection is invalid. Please select the Recipe again.",
				"error"
			);
			return false;
		}

		try {
			const result = await apiRecLstDelete.run({
				recipe_id: recipeId,
				expected_revision: revision
			});

			if (
				result?.authenticated !== true ||
				Number(result.recipe_id) !== recipeId
			) {
				throw new Error("Recipe deletion was not confirmed.");
			}

			await removeValue("current_recipe_id");
			await removeValue("RecListDeleteTarget");

			closeModal(mdlRecLstDelete.name);

			const refreshed = await apiRecLstGetRecipes.run();

			if (
				refreshed?.authenticated !== true ||
				!Array.isArray(refreshed?.recipes)
			) {
				showAlert(
					"Recipe deleted, but the list could not be refreshed.",
					"warning"
				);
				return true;
			}

			showAlert("Recipe deleted.", "success");
			return true;

		} catch (error) {
			const response = [
				JSON.stringify(apiRecLstDelete.data || {}),
				String(error?.message || "")
			].join(" ");

			if (response.includes("RECIPE_REVISION_CONFLICT")) {
				closeModal(mdlRecLstDelete.name);
				await removeValue("RecListDeleteTarget");

				showAlert(
					"This Recipe was changed by another user. " +
					"It has not been deleted. Refresh RecipeList " +
					"before trying again.",
					"warning"
				);

				return false;
			}

			showAlert(
				jsUserErrors.friendly(error),
				"error"
			);
			return false;
		}
	},

	impactRecipeCount() {
		return Number(
			apiRecLstGetImpactCount.data?.impact?.recipe_count || 0
		);
	},

	impactDishCount() {
		return Number(
			apiRecLstGetImpactCount.data?.impact?.dish_count || 0
		);
	},

	impactMenuCount() {
		return Number(
			apiRecLstGetImpactCount.data?.impact?.menu_count || 0
		);
	},

	impactEventCount() {
		return Number(
			apiRecLstGetImpactCount.data?.impact?.event_count || 0
		);
	},

	deleteImpactText() {
		return `This will impact
    Recipes: ${this.impactRecipeCount()}
    Dishes: ${this.impactDishCount()}
    Menus: ${this.impactMenuCount()}`;
	},

	showDeleteImpact() {
		return (
			this.impactRecipeCount() +
			this.impactDishCount() +
			this.impactMenuCount()
		) > 0;
	},



	async setActive(row, active) {
		if (!(await jsAuthSession.requireValid())) {
			return false;
		}

		const recipeId = Number(row?.id);

		if (!Number.isSafeInteger(recipeId) || recipeId <= 0) {
			showAlert("Invalid Recipe ID.", "error");
			return false;
		}

		const savedRow = (apiRecLstGetRecipes.data?.recipes || [])
		.find(r => Number(r.id) === recipeId);

		if (!savedRow || typeof active !== "boolean") {
			showAlert("Invalid Recipe Status request.", "error");
			return false;
		}

		const key = String(recipeId);
		const confirmed = appsmith.store.RecListConfirmedActive || {};
		const overlay = confirmed[key];

		const previousActive =
					overlay && typeof overlay.active === "boolean"
		? overlay.active
		: savedRow.active;

		if (active === previousActive) return true;

		if (appsmith.store.RecListRefreshing === true) {
			showAlert("Please wait for RecipeList to finish refreshing.", "warning");
			return false;
		}

		const pending = appsmith.store.RecListStatusSaving || {};

		if (pending[key]) {
			showAlert("This Recipe is already being updated.", "warning");
			return false;
		}

		const revision = Number(
			overlay && overlay.revision != null
			? overlay.revision
			: savedRow.revision
		);

		if (!Number.isSafeInteger(revision) || revision < 1) {
			showAlert("Recipe revision is unavailable. Refresh RecipeList.", "warning");
			return false;
		}

		await storeValue("RecList_selected_id", recipeId);
		await storeValue(
			"RecListStatusSaving",
			{ ...pending, [key]: true },
			false
		);

		try {
			const result = await apiRecLstSetActive.run({
				recipe_id: recipeId,
				active: active,
				expected_revision: revision
			});

			const newRevision = Number(result?.revision);

			if (
				result?.authenticated !== true ||
				Number(result.recipe_id) !== recipeId ||
				typeof result.active !== "boolean" ||
				!Number.isSafeInteger(newRevision) ||
				newRevision <= revision
			) {
				throw new Error("Recipe Status was not confirmed.");
			}

			await storeValue(
				"RecListConfirmedActive",
				{
					...(appsmith.store.RecListConfirmedActive || {}),
					[key]: {
						active: result.active,
						revision: newRevision
					}
				},
				false
			);

			return true;

		} catch (error) {
			const response = [
				JSON.stringify(apiRecLstSetActive.data || {}),
				String(error?.message || "")
			].join(" ");

			if (response.includes("RECIPE_REVISION_CONFLICT")) {
				showAlert(
					"This Recipe was changed by another user. " +
					"Status was not updated. Refresh RecipeList before trying again.",
					"warning"
				);
			} else {
				showAlert(
					"Recipe Status could not be saved. The previous Status has been restored.",
					"error"
				);
			}

			return false;

		} finally {
			const current = {
				...(appsmith.store.RecListStatusSaving || {})
			};

			delete current[key];

			await storeValue("RecListStatusSaving", current, false);
		}
	},

	async refresh() {
		if (!(await jsAuthSession.requireValid())) {
			return false;
		}
		const saving = appsmith.store.RecListStatusSaving || {};

		if (Object.values(saving).some(value => value === true)) {
			showAlert(
				"Please wait for the Recipe Status update to finish.",
				"warning"
			);
			return false;
		}

		if (appsmith.store.RecListRefreshing === true) {
			return false;
		}

		await storeValue("RecListRefreshing", true, false);

		try {
			const result = await apiRecLstGetRecipes.run();

			if (
				result?.authenticated !== true ||
				!Array.isArray(result?.recipes)
			) {
				throw new Error("RecipeList refresh failed.");
			}

			await storeValue("RecListConfirmedActive", {}, false);

			showAlert("RecipeList refreshed.", "success");
			return true;

		} catch (error) {
			console.error("RecipeList refresh failed:", error);

			showAlert(
				"Unable to refresh RecipeList. Please try again.",
				"error"
			);

			return false;

		} finally {
			await storeValue("RecListRefreshing", false, false);
		}
	},

	searchText() {
		return String(
			inpRecLstSearch.text || ""
		)
			.trim()
			.toLowerCase();
	},

	statusFilter() {
		return String(
			selRecLstFilter.selectedOptionValue || "all"
		).toLowerCase();
	},

	filteredRows() {
		const search = this.searchText();
		const status = this.statusFilter();

		return (apiRecLstGetRecipes.data?.recipes || [])

			.map(row => {
			const confirmed =
						appsmith.store.RecListConfirmedActive || {};

			const saved = confirmed[String(row.id)];

			if (
				saved &&
				typeof saved === "object" &&
				typeof saved.active === "boolean"
			) {
				return {
					...row,
					active: saved.active,
					revision: saved.revision
				};
			}

			return row;
		})

			.filter(row => {
			if (status === "active" && row.active !== true) return false;
			if (status === "inactive" && row.active !== false) return false;
			return true;
		})
			.filter(row => {
			if (!search) return true;

			const haystack = [
				row.name,
				row.category_name,
				row.yield_unit,
				row.diet_tag_names,
				row.derived_allergens
			]
			.map(x => String(x || "").toLowerCase())
			.join(" ");

			return haystack.includes(search);
		});
	}
};