export default {
	pendingAction: null,

	async initializeCreateRequest() {
		const requestId = crypto.randomUUID();

		await storeValue(
			"rec_create_request_id",
			requestId,
			false
		);

		return requestId;
	},

	async safeReset(widgetName) {
		try {
			await resetWidget(widgetName, true);
		} catch (e) {
			return null;
		}
	},

	saveSnapshot() {
		return (
			appsmith.store.recipe_save_snapshot ||
			jsRecWorkspace.current()
		);
	},

	headerPayload() {
		return {
			...this.saveSnapshot().header
		};
	},

	dietTagsPayload() {
		return (
			this.saveSnapshot().diet_tags || []
		).map(id => ({
			tag_id: Number(id)
		}));
	},

	componentsPayload() {
		return (
			this.saveSnapshot().components || []
		).map(row => ({
			item_type:
			row.item_type || null,

			ingredient_id:
			row.item_type === "ingredient"
			? Number(row.ingredient_id) || null
			: null,

			child_recipe_id:
			row.item_type === "recipe"
			? Number(row.child_recipe_id) || null
			: null,

			qty:
			row.qty == null
			? null
			: Number(row.qty),

			unit_id:
			row.unit_id == null
			? null
			: Number(row.unit_id),

			apply_wastage:
			row.apply_wastage !== false,

			active:
			row.active !== false
		}));
	},

	requiredSaveMessage(snapshot) {
		const name =
					String(
						snapshot?.header?.name || ""
					).trim();

		return name
			? null
		: "Recipe Name is required before you can save.";
	},

	validateBeforeSave(snapshot) {
		const message =
					this.requiredSaveMessage(snapshot);

		if (message) {
			showAlert(
				message,
				"warning"
			);

			return false;
		}

		return true;
	},

	isDirty() {
		return jsRecWorkspace.isDirty();
	},

	yieldUnitChanged(snapshot) {
		const baseline =
					jsRecWorkspace.baseline();

		const oldUnitId =
					Number(
						baseline?.header?.yield_unit_id || 0
					);

		const newUnitId =
					Number(
						snapshot?.header?.yield_unit_id || 0
					);

		return oldUnitId !== newUnitId;
	},

	impactCount() {
		const impact = apiRecGetImpactCount.data?.impact || {};

		return (
			Number(impact.recipe_count || 0) +
			Number(impact.dish_count || 0) +
			Number(impact.menu_count || 0)
		);
	},

	async checkYieldUnitChange(snapshot) {
		const recipeId =
					Number(
						appsmith.store.current_recipe_id || 0
					);

		if (!recipeId) {
			return false;
		}

		if (!this.yieldUnitChanged(snapshot)) {
			return false;
		}

		/*
	 * Preserve the exact current Recipe state
	 * before running the impact query.
	 *
	 * The query can cause Appsmith widgets to
	 * re-evaluate their defaults.
	 */
		await jsRecWorkspace.setWorkspace(
			snapshot
		);

		await storeValue(
			"recipe_save_snapshot",
			snapshot
		);

		await apiRecGetImpactCount.run();

		if (this.impactCount() === 0) {
			return false;
		}

		await storeValue(
			"recipe_impact_mode",
			"unit_change"
		);

		showModal(
			mdlRecDeleteConfirm.name
		);

		return true;
	},


	async saveRecipe() {
		let databaseSaved = false;
		let savedId = 0;

		try {
			const wasNew =
						Number(appsmith.store.current_recipe_id || 0) === 0;

			if (
				wasNew &&
				!appsmith.store.rec_create_request_id
			) {
				await this.initializeCreateRequest();
			}

			await jsRecCompTable.syncFromTable();

			const snapshot = jsRecWorkspace.current();

			if (!this.validateBeforeSave(snapshot)) {
				return false;
			}

			if (
				!appsmith.store.recipe_unit_change_confirmed &&
				await this.checkYieldUnitChange(snapshot)
			) {
				return false;
			}

			await storeValue(
				"recipe_save_snapshot",
				snapshot
			);

			if (!(await jsAuthSession.requireValid())) {
				return false;
			}

			const result = await apiRecSaveRecipe.run();

			if (!result?.authenticated) {
				throw new Error(
					"Recipe Save authentication failed."
				);
			}

			savedId = Number(result.recipe_id || 0);

			if (!savedId) {
				throw new Error(
					"Recipe Save did not return a Recipe ID."
				);
			}

			databaseSaved = true;

			await removeValue("recipe_conflict_revision");
			await removeValue("recipe_pending_conflict_revision");

			await storeValue(
				"current_recipe_id",
				savedId
			);

			// The Recipe now has a confirmed database identity.
			await removeValue("rec_create_request_id");

			if (wasNew) {
				const items = await apiRecGetComponentItems.run();

				if (
					items?.authenticated !== true ||
					!Array.isArray(items.component_items)
				) {
					throw new Error(
						"Component options could not be refreshed."
					);
				}
			}

			const detail = await apiRecGetDetail.run();

			if (
				detail?.authenticated !== true ||
				!detail.recipe ||
				Number(detail.recipe.id) !== savedId
			) {
				throw new Error(
					"Saved Recipe details could not be reloaded."
				);
			}

			await jsRecCompTable.loadFromQuery();

			await jsRecWorkspace.initializeFromSaved();

			await removeValue("recipe_save_snapshot");
			await removeValue("recipe_unit_change_confirmed");
			await removeValue("recipe_impact_mode");

			await storeValue("Recipe_mode", "edit");
			await removeValue("Recipe_open_mode");

			showAlert("Recipe saved.", "success");

			return true;

		} catch (error) {
			console.error("Recipe Save failed:", error);


			const conflictRevision = this.recipeConflictResponse(error);

			if (!databaseSaved && conflictRevision) {
				await removeValue("recipe_conflict_revision");

				await storeValue(
					"recipe_pending_conflict_revision",
					conflictRevision
				);

				showModal(mdlRecRevisionConflict.name);
				return false;
			}


			if (databaseSaved) {
				// Database commit succeeded, but frontend
				// synchronization did not complete.
				await removeValue("rec_create_request_id");

				showAlert(
					"Recipe saved to Supabase, but the page could not refresh completely. Reopen the Recipe to reload its saved data.",
					"warning"
				);

				return false;
			}

			await removeValue("recipe_save_snapshot");
			await removeValue("recipe_unit_change_confirmed");

			const message = [
				JSON.stringify(apiRecSaveRecipe.data || {}),
				String(error?.message || "")
			].join(" ");

			jsUserErrors.show(
				message,
				"Unable to save Recipe."
			);

			return false;
		}
	},

	async discardRecipe() {
		const recipeId = Number(
			appsmith.store.current_recipe_id || 0
		);

		const mode = String(
			appsmith.store.Recipe_mode || ""
		);

		try {
			if (recipeId > 0) {
				// Existing saved Recipe:
				// restore current saved Supabase data.
				const detail = await apiRecGetDetail.run();

				if (
					detail?.authenticated !== true ||
					!detail.recipe ||
					Number(detail.recipe.id) !== recipeId
				) {
					showAlert(
						"Unable to reload the saved Recipe.",
						"error"
					);

					return false;
				}

				await jsRecWorkspace.initializeFromSaved();
				await jsRecCompTable.loadFromQuery();

			} else if (
				mode === "duplicate" &&
				appsmith.store.recipe_duplicate_initial
			) {
				// Unsaved duplicate:
				// restore its original duplicated contents.
				const initial =
							jsRecWorkspace.normalizeSnapshot(
								appsmith.store.recipe_duplicate_initial
							);

				await jsRecWorkspace.setWorkspace(initial);

				await jsRecCompTable.setRows(
					initial.components
				);

			} else {
				// New Recipe created through Add:
				// restore a blank workspace.
				await jsRecWorkspace.initializeNew();
				await jsRecCompTable.clearRows();
			}

			await this.safeReset("inpRecName");
			await this.safeReset("selRecCategory");
			await this.safeReset("chkRecActive");
			await this.safeReset("inpRecYieldQty");
			await this.safeReset("selRecYieldUnit");
			await this.safeReset("inpRecExtraPercent");
			await this.safeReset("msRecDietTags");
			await this.safeReset("rteRecNotes");
			await this.safeReset("tblRecComponents");

			closeModal(mdlRecDiscardConfirm.name);

			return true;

		} catch (error) {
			console.error(
				"Recipe Discard failed:",
				error
			);

			showAlert(
				"Unable to discard Recipe changes.",
				"error"
			);

			return false;
		}
	},

	getUnsavedPromptText() {
		const recipeId = Number(appsmith.store.current_recipe_id || 0);
		const mode = String(appsmith.store.Recipe_mode || "");
		const action = this.pendingAction;

		if (action === "add") {
			if (recipeId > 0) {
				return "You have unsaved changes. Save them before starting a new Recipe, discard them, or cancel to continue editing.";
			}

			return mode === "duplicate"
				? "This duplicate has not been saved. Save it before starting a new Recipe, discard it, or cancel to continue editing."
			: "This Recipe has not been saved. Save it before starting a new Recipe, discard it, or cancel to continue editing.";
		}

		if (recipeId > 0) {
			return "You have unsaved changes. Do you want to save or discard your changes before closing?";
		}

		if (mode === "duplicate") {
			return "This duplicate has not been saved.<br> Save will create the duplicate before closing.<br> Discard will abandon it.<br> Cancel will return you to the duplicate.";
		}

		return "This Recipe has not been saved.<br> Save will create the Recipe before closing.<br> Discard will abandon it.<br> Cancel will return you to the Recipe.";
	},

	async closeRecipe() {
		const snapshot = await jsRecWorkspace.capture();

		if (jsRecWorkspace.isSnapshotDirty(snapshot)) {
			this.pendingAction = "close";

			await storeValue(
				"rec_unsaved_prompt_text",
				this.getUnsavedPromptText(),
				false
			);

			showModal(mdlRecUnsavedChanges.name);

			return false;
		}

		const recipeId = Number(appsmith.store.current_recipe_id || 0);

		if (recipeId > 0) {
			await storeValue("RecList_selected_id", recipeId, false);
		}

		await storeValue("RecList_returning_from_recipe", true, false);

		navigateTo("RecipeList");

		return true;
	},

	async saveAndCloseRecipe() {
		const saved =
					await this.saveRecipe();

		if (!saved) {
			return false;
		}

		closeModal(
			mdlRecUnsavedChanges.name
		);

		await storeValue(
			"RecList_selected_id",
			Number(appsmith.store.current_recipe_id),
			false
		);

		await storeValue(
			"RecList_returning_from_recipe",
			true,
			false
		);		

		navigateTo(
			"RecipeList"
		);

		return true;
	},

	async closeWithoutSaving() {
		closeModal(
			mdlRecUnsavedChanges.name
		);

		await storeValue("RecList_returning_from_recipe", true, false);

		navigateTo(
			"RecipeList"
		);

		return true;
	},

	async startNewRecipe() {
		await this.initializeCreateRequest();
		await storeValue(
			"current_recipe_id",
			0
		);

		await storeValue(
			"Recipe_mode",
			"add"
		);

		await jsRecCompTable.clearRows();

		await jsRecWorkspace
			.initializeNew();

		await this.safeReset("inpRecName");
		await this.safeReset("selRecCategory");
		await this.safeReset("chkRecActive");
		await this.safeReset("inpRecYieldQty");
		await this.safeReset("selRecYieldUnit");
		await this.safeReset("inpRecExtraPercent");
		await this.safeReset("msRecDietTags");
		await this.safeReset("rteRecNotes");
		await this.safeReset("tblRecComponents");

		return true;
	},

	async addRecipe() {
		await jsRecWorkspace.capture();

		if (this.isDirty()) {
			this.pendingAction = "add";

			await storeValue(
				"rec_unsaved_prompt_text",
				this.getUnsavedPromptText(),
				false
			);

			showModal(
				mdlRecUnsavedChanges.name
			);

			return false;
		}

		return await this.startNewRecipe();
	},

	async saveAndAddRecipe() {
		const saved =
					await this.saveRecipe();

		if (!saved) {
			return false;
		}

		closeModal(
			mdlRecUnsavedChanges.name
		);

		return await this.startNewRecipe();
	},

	async addWithoutSaving() {
		closeModal(
			mdlRecUnsavedChanges.name
		);

		return await this.startNewRecipe();
	},

	async nextDuplicateName(sourceName) {
		const baseName = String(sourceName || "").trim();

		if (!baseName) return "";

		const result = await apiRecGetNames.run();

		if (!result?.authenticated || !Array.isArray(result.recipes)) {
			throw new Error("Could not retrieve existing Recipe names.");
		}

		const existing = new Set(
			result.recipes.map(row =>
												 String(row.name || "").trim().toLowerCase()
												)
		);

		// Match Ingredients: keep a unique working name.
		if (!existing.has(baseName.toLowerCase())) {
			return baseName;
		}

		// Only generate a copy name when the name already exists.
		let candidate = `${baseName} - copy`;
		let number = 2;

		while (existing.has(candidate.toLowerCase())) {
			candidate = `${baseName} - copy ${number}`;
			number++;
		}

		return candidate;
	},

	async duplicateRecipe() {
		const sourceId =
					Number(
						appsmith.store.current_recipe_id || 0
					);

		if (!sourceId) {
			showAlert(
				"This Recipe has not been saved yet.",
				"warning"
			);

			return false;
		}

		/*
	Capture exactly what is currently
	in front of the user.
	*/
		const source =
					await jsRecWorkspace.capture();

		const currentName =
					String(
						source.header.name || ""
					).trim();

		const duplicateName =
					await this.nextDuplicateName(currentName);

		const duplicate = {
			header: {
				...source.header,
				name:
				duplicateName
			},

			diet_tags: [
				...(source.diet_tags || [])
			],

			components:
			(source.components || [])
			.map(row => ({
				...row,

				id:
				null,

				recipe_id:
				0,

				draft_row_id:
				jsRecCompTable.makeDraftId()
			}))
		};

		await this.initializeCreateRequest();

		await storeValue(
			"current_recipe_id",
			0
		);

		await storeValue(
			"Recipe_mode",
			"duplicate"
		);

		await jsRecWorkspace
			.initializeDuplicate(
			duplicate
		);

		await jsRecCompTable.setRows(
			duplicate.components
		);

		await this.safeReset("inpRecName");
		await this.safeReset("selRecCategory");
		await this.safeReset("chkRecActive");
		await this.safeReset("inpRecYieldQty");
		await this.safeReset("selRecYieldUnit");
		await this.safeReset("inpRecExtraPercent");
		await this.safeReset("msRecDietTags");
		await this.safeReset("rteRecNotes");
		await this.safeReset("tblRecComponents");

		showAlert(
			"Recipe duplicated. Save it before making changes to enable all Recipe features.",
			"success"
		);

		return true;
	},

	async deleteRecipeStart() {
		await jsRecWorkspace.capture();

		await storeValue(
			"recipe_impact_mode",
			"delete"
		);

		await apiRecGetImpactCount.run();

		showModal(mdlRecDeleteConfirm.name);

		return true;
	},

	async confirmImpactAction() {
		const mode =
					String(
						appsmith.store.recipe_impact_mode || "delete"
					);

		if (mode === "unit_change") {
			await storeValue(
				"recipe_unit_change_confirmed",
				true
			);

			closeModal(
				mdlRecDeleteConfirm.name
			);

			return await this.saveRecipe();
		}

		return await this.deleteRecipeConfirm();
	},

	async deleteRecipeConfirm() {
		try {
			if (!(await jsAuthSession.requireValid())) {
				return false;
			}
			const result = await apiRecDeleteRecipe.run();

			if (!result?.authenticated) {
				throw new Error("Recipe Delete authentication failed.");
			}

			const deletedId = Number(result.recipe_id || 0);
			const currentId = Number(
				appsmith.store.current_recipe_id || 0
			);

			if (!deletedId || deletedId !== currentId) {
				showAlert("Recipe was not deleted.", "error");
				return false;
			}

			closeModal(mdlRecDeleteConfirm.name);

			await storeValue("current_recipe_id", 0);
			await jsRecCompTable.clearRows();
			await jsRecWorkspace.clear();

			showAlert("Recipe deleted.", "success");
			navigateTo("RecipeList");

			return true;

		} catch (error) {
			const data = apiRecDeleteRecipe.data || {};

			const response = [
				JSON.stringify(data),
				String(error?.message || "")
			].join(" ");

			if (response.includes("RECIPE_REVISION_CONFLICT")) {
				closeModal(mdlRecDeleteConfirm.name);

				showAlert(
					"This Recipe has been changed by another user. " +
					"Your Recipe has not been deleted. " +
					"Your current work is preserved. " +
					"Reload the Recipe to review the latest saved version " +
					"before attempting Delete again.",
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
			apiRecGetImpactCount.data?.impact?.recipe_count || 0
		);
	},

	impactDishCount() {
		return Number(
			apiRecGetImpactCount.data?.impact?.dish_count || 0
		);
	},

	impactMenuCount() {
		return Number(
			apiRecGetImpactCount.data?.impact?.menu_count || 0
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
			appsmith.store.recipe_impact_mode !== "unit_change" &&
			(
				this.impactRecipeCount() +
				this.impactDishCount() +
				this.impactMenuCount()
			) > 0
		);
	},

	async unsavedYes() {
		switch (this.pendingAction) {
			case "close":
				return await this.saveAndCloseRecipe();

			case "add":
				return await this.saveAndAddRecipe();

			default:
				return false;
		}
	},

	async unsavedNo() {
		switch (this.pendingAction) {
			case "close":
				return await this.closeWithoutSaving();

			case "add":
				return await this.addWithoutSaving();

			default:
				return false;
		}
	},


	recipeConflictResponse(error) {
		const data = apiRecSaveRecipe.data || {};

		const response = [
			JSON.stringify(data),
			String(error?.message || "")
		].join(" ");

		if (
			data.code !== "RECIPE_REVISION_CONFLICT" &&
			!response.includes("RECIPE_REVISION_CONFLICT")
		) {
			return null;
		}

		const revision = Number(
			data.current_revision ||
			response.match(/current_revision["\s:]+(\d+)/)?.[1] ||
			0
		);

		return revision > 0 ? revision : null;
	},

	async confirmRevisionOverwrite() {
		const revision = Number(
			appsmith.store.recipe_pending_conflict_revision || 0
		);

		if (!revision) {
			showAlert(
				"Recipe conflict information is missing. Please try Save again.",
				"warning"
			);
			return false;
		}

		await storeValue("recipe_conflict_revision", revision);

		closeModal(mdlRecRevisionConflict.name);

		return await this.saveRecipe();
	},	
};