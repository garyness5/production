export default {
	async loadSecureHelpers() {
		const response = await apiRecGetLookups.run();



		if (
			response?.authenticated !== true ||
			!Array.isArray(response.recipe_categories) ||
			!Array.isArray(response.diet_tags) ||
			!Array.isArray(response.ingredient_categories) ||
			!Array.isArray(response.allergens) ||
			!Array.isArray(response.suppliers) ||
			!Array.isArray(response.packaging) ||
			!Array.isArray(response.units)
		) {
			throw new Error("Unable to load Recipe lookups");
		}

		const activeItems = rows =>
		rows
		.filter(row => row.active === true)
		.map(row => ({
			id: Number(row.id),
			name: row.name
		}));

		await Promise.all([
			storeValue("rec_categories", activeItems(response.recipe_categories)),
			storeValue("rec_diet_tags", activeItems(response.diet_tags)),
			storeValue("rec_ing_categories", activeItems(response.ingredient_categories)),
			storeValue("rec_ing_allergens", activeItems(response.allergens)),
			storeValue("rec_ing_diet_tags", activeItems(response.diet_tags)),
			storeValue("rec_ing_suppliers", activeItems(response.suppliers)),
			storeValue("rec_ing_packaging", activeItems(response.packaging)),
			storeValue("rec_units", response.units)
		]);

		return true;
	},


	async load() {
		await storeValue("recPageReady", false);
		let stage = "session";

		try {
			const ok = await jsAppInit.init();
			if (!ok) return false;

			const mode = String(
				appsmith.store.Recipe_open_mode ||
				appsmith.store.Recipe_mode ||
				"edit"
			);

			const recipeId = Number(
				appsmith.store.current_recipe_id || 0
			);

			const validId =
						Number.isSafeInteger(recipeId) && recipeId > 0;

			if (!["add", "edit", "duplicate"].includes(mode)) {
				throw new Error(
					"Unsupported Recipe opening mode: " + mode
				);
			}

			if (mode !== "add" && !validId) {
				throw new Error(
					"RecipeList did not provide a valid Recipe ID for " +
					mode +
					". Return to RecipeList and select the Recipe again."
				);
			}

			stage = "Recipe reference data";

			const [helpersLoaded, components, detail] =
						await Promise.all([
							this.loadSecureHelpers(),
							apiRecGetComponentItems.run(),
							mode !== "add"
							? apiRecGetDetail.run()
							: Promise.resolve(null)
						]);

			if (helpersLoaded !== true) {
				throw new Error(
					"Recipe lookups were not confirmed."
				);
			}

			if (
				components?.authenticated !== true ||
				!Array.isArray(components.component_items)
			) {
				throw new Error(
					"Recipe component items response was invalid."
				);
			}

			if (
				mode !== "add" &&
				(
					detail?.authenticated !== true ||
					!detail?.recipe ||
					Number(detail.recipe.id) !== recipeId
				)
			) {
				throw new Error(
					"Recipe detail response did not match selected Recipe ID " +
					recipeId +
					"."
				);
			}
			
			stage = "workspace initialization";

			await jsRecWorkspace.clear();

			if (mode === "add") {
				await jsRecWorkspace.initializeNew();
				await jsRecCompTable.clearRows();
				await removeValue("Recipe_open_mode");
				await storeValue("recPageReady", true);

			} else {
				await jsRecWorkspace.initializeFromSaved();
				await jsRecCompTable.loadFromQuery();

				if (mode === "duplicate") {
					await removeValue("Recipe_open_mode");

					stage = "duplicate workspace";

					// RecipeList Duplicate starts from the saved Recipe,
					// not from widgets that may not have initialized yet.
					const source = jsRecWorkspace.savedTruth();

					const sourceName = String(
						source.header.name || ""
					).trim();

					if (!sourceName) {
						throw new Error(
							"The selected Recipe has no saved Name."
						);
					}

					const duplicateName =
								await jsRecSave.nextDuplicateName(sourceName);

					const duplicate = {
						header: {
							...source.header,
							name: duplicateName
						},

						diet_tags: [
							...(source.diet_tags || [])
						],

						components: (source.components || []).map(row => ({
							...row,
							id: null,
							recipe_id: 0,
							draft_row_id: jsRecCompTable.makeDraftId()
						}))
					};

					await jsRecSave.initializeCreateRequest();

					await storeValue("current_recipe_id", 0);
					await storeValue("Recipe_mode", "duplicate");

					await jsRecWorkspace.initializeDuplicate(duplicate);

					await jsRecCompTable.setRows(
						duplicate.components
					);

					await storeValue("recPageReady", true);

				} else {
					await removeValue("Recipe_open_mode");
					await storeValue("Recipe_mode", "edit");

					await storeValue(
						"recipe_workspace_user_id",
						String(appsmith.store.workspace_owner_user_id)
					);

					await storeValue(
						"recipe_workspace_recipe_id",
						recipeId
					);

					await storeValue("recPageReady", true);
				}
			}

			stage = "widget reset";

			for (const name of [
				"inpRecName",
				"selRecCategory",
				"chkRecActive",
				"inpRecYieldQty",
				"selRecYieldUnit",
				"inpRecExtraPercent",
				"msRecDietTags",
				"rteRecNotes"
			]) {
				await resetWidget(name, true);
			}

			return true;

		} catch (error) {
			await storeValue("recPageReady", false);

			const message = String(
				error?.message || error || "Unknown error"
			);

			console.error(
				"Recipe initialization failed at " + stage + ":",
				error
			);

			showAlert(
				"Recipe load failed at " +
				stage +
				": " +
				message,
				"error"
			);

			return false;
		}
	}

};