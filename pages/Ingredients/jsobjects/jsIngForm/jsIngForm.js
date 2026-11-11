export default {
	CONTEXT_ADD_INGREDIENTS: "addFromIngredients",
	CONTEXT_EDIT_INGREDIENTS: "editFromIngredients",

	// ============================================================
	// OPEN ADD
	// ============================================================

	async openAddFromIngredients() {
		await storeValue("IngForm_context", this.CONTEXT_ADD_INGREDIENTS);
		await storeValue("IngForm_mode", "add");
		await storeValue("IngForm_edit_id", null);
		await storeValue("IngForm_edit_row", null);

		await removeValue("IngForm_duplicate_allergens");
		await removeValue("IngForm_duplicate_diet_tags");
		await removeValue("IngForm_duplicate_row");
		await removeValue("IngForm_saved_id");
		await removeValue("IngForm_pending_action");
		await removeValue("IngForm_restoring");
		await removeValue("IngForm_pending_state");
		await resetWidget("mdlAddIng", true);

		showModal(mdlAddIng.name);
		await this.captureBaseline();

		return true;
	},

	// ============================================================
	// OPEN EDIT
	// ============================================================


	async openEditFromIngredients(row = null) {
		const id = Number(
			row?.id ??
			appsmith.store.IngList_selected_id ??
			tblIngList.selectedRow?.id ??
			0
		);

		if (!id) {
			showAlert("Select an ingredient to edit.", "warning");
			return false;
		}

		const savedRow = (
			apiGetMyIngredients.data?.ingredients || []
		).find(r => Number(r.id) === id);

		const pendingChanges =
					jsIngBatch.pending()[String(id)] || {};

		const editRow = savedRow
		? { ...savedRow, ...pendingChanges }
		: null;

		if (!editRow?.id) {
			showAlert("Ingredient could not be identified.", "error");
			return false;
		}

		try {
			const response = await apiIngListTags.run();

			if (
				response?.ok !== true ||
				!Array.isArray(response.tags)
			) {
				throw new Error("Ingredient tags could not be loaded.");
			}

			const ingredientTags = response.tags.filter(
				tag => Number(tag.ingredient_id) === id
			);

			await storeValue(
				"IngForm_context",
				this.CONTEXT_EDIT_INGREDIENTS
			);
			await storeValue("IngForm_mode", "edit");
			await storeValue("IngForm_edit_id", id);
			await storeValue("IngForm_edit_row", editRow);

			await storeValue(
				"IngForm_duplicate_allergens",
				ingredientTags
				.filter(tag => tag.tag_type === "allergen")
				.map(tag => Number(tag.helper_list_item_id))
			);

			await storeValue(
				"IngForm_duplicate_diet_tags",
				ingredientTags
				.filter(tag => tag.tag_type === "diet_tag")
				.map(tag => Number(tag.helper_list_item_id))
			);

			await removeValue("IngForm_duplicate_row");
			await removeValue("IngForm_saved_id");
			await removeValue("IngForm_pending_action");

			await resetWidget("mdlAddIng", true);
			showModal(mdlAddIng.name);
			await this.captureBaseline();

			return true;
		} catch (error) {
			jsUserErrors.show(
				error,
				"Ingredient could not be opened."
			);
			return false;
		}
	},


	// ============================================================
	// MODE AND ROW
	// ============================================================

	isEdit() {
		return (
			!!appsmith.store.IngForm_restoring ||
			appsmith.store.IngForm_mode === "edit" ||
			appsmith.store.IngForm_mode === "duplicate"
		);
	},

	editRow() {
		if (
			appsmith.store.IngForm_restoring === true &&
			appsmith.store.IngForm_pending_state
		) {
			return appsmith.store.IngForm_pending_state;
		}

		if (appsmith.store.IngForm_mode === "duplicate") {
			return appsmith.store.IngForm_duplicate_row || {};
		}

		return appsmith.store.IngForm_edit_row || {};
	},

	// ============================================================
	// WORKING STATE
	// ============================================================

	currentState() {
		const valueOrNull = value =>
		value === undefined || value === null || value === ""
		? null
		: String(value);

		return {
			name: inpIngIngredient.text?.trim() || "",

			category_id: valueOrNull(
				selIngCategory.selectedOptionValue
			),

			purchase_qty: inpIngQuantity.text || "",

			purchase_unit_id: valueOrNull(
				selIngPurchaseUnit.selectedOptionValue
			),

			total_cost: inpIngPurchaseCost.text || "",

			wastage_percent: inpIngWastage.text || "",

			supplier_id: valueOrNull(
				selIngSupplier.selectedOptionValue
			),

			packaging_id: valueOrNull(
				selIngPackaging.selectedOptionValue
			),

			item_code: inpIngSupplierCode.text?.trim() || "",
			notes: rteIngNotes.text || "",
			active: chkIngActive.isChecked !== false,

			allergens: (
				msIngAllergens.selectedOptionValues || []
			).map(String).sort(),

			diet_tags: (
				msIngDietTags.selectedOptionValues || []
			).map(String).sort()
		};
	},

	async captureBaseline() {
		await storeValue(
			"IngForm_baseline",
			JSON.stringify(this.currentState())
		);

		return true;
	},

	isDirty() {
		if (appsmith.store.IngForm_mode === "duplicate") {
			return true;
		}

		const baseline = appsmith.store.IngForm_baseline;

		if (!baseline) {
			return false;
		}

		return JSON.stringify(this.currentState()) !== baseline;
	},

	canSave() {
		const hasName = Boolean(inpIngIngredient.text?.trim());

		const ingredientId = Number(
			appsmith.store.IngForm_edit_id || 0
		);

		const hasPendingInlineChanges =
					appsmith.store.IngForm_mode === "edit" &&
					ingredientId > 0 &&
					Boolean(
						Object.keys(
							jsIngBatch.pending()[String(ingredientId)] || {}
						).length
					);

		return hasName &&
			(this.isDirty() || hasPendingInlineChanges);
	},

	unitTypeChanged(ingredientId, newUnitId) {
		if (!ingredientId || !newUnitId) return false;

		const saved = (apiGetMyIngredients.data?.ingredients || [])
		.find(r => Number(r.id) === Number(ingredientId));

		if (!saved?.purchase_unit_id) return false;

		const units = apiIngGetIngredientLookups.data?.units || [];

		const oldUnit = units.find(
			u => Number(u.id) === Number(saved.purchase_unit_id)
		);

		const newUnit = units.find(
			u => Number(u.id) === Number(newUnitId)
		);

		if (!oldUnit || !newUnit) return false;

		return oldUnit.unit_type !== newUnit.unit_type;
	},

	// ============================================================
	// SAVE
	// Name is the only required field.
	// ============================================================


	async save(
		closeAfterSave = true,
		stateOverride = null,
		unitTypeConfirmed = false
	) {
		if (!(await jsAuthSession.requireValid())) return false;

		const state = stateOverride || this.currentState();

		if (!state.name) {
			showAlert("Ingredient Name is required.", "warning");
			return false;
		}

		const numericOrNull = value => {
			if (value === "" || value === null || value === undefined) {
				return null;
			}

			const cleaned = String(value)
			.trim()
			.replace(/,/g, "")
			.replace(/\s/g, "");

			return cleaned === "" ? null : Number(cleaned);
		};

		const purchaseQty = numericOrNull(state.purchase_qty);
		const totalCost = numericOrNull(state.total_cost);
		const waste = numericOrNull(state.wastage_percent);

		if (
			(purchaseQty !== null &&
			 (!Number.isFinite(purchaseQty) || purchaseQty < 0)) ||
			(totalCost !== null &&
			 (!Number.isFinite(totalCost) || totalCost < 0)) ||
			(waste !== null &&
			 (!Number.isFinite(waste) || waste < 0 || waste >= 100))
		) {
			showAlert(
				"Check Purchase Qty, Purchase Cost and Waste %. Values must be nonnegative, and Waste must be below 100%.",
				"warning"
			);
			return false;
		}

		const payload = {
			name: state.name,
			category_id: state.category_id,
			purchase_qty: purchaseQty,
			purchase_unit_id: state.purchase_unit_id,
			total_cost: totalCost,
			wastage_percent: waste,
			supplier_id: state.supplier_id,
			packaging_id: state.packaging_id,
			item_code: state.item_code,
			notes: state.notes,
			active: state.active,
			allergen_ids: state.allergens.map(Number),
			diet_tag_ids: state.diet_tags.map(Number)
		};

		if (unitTypeConfirmed) {
			const confirmation = appsmith.store.IngUnitPendingSave;

			if (!confirmation) {
				showAlert("Unit Type confirmation is missing.", "error");
				return false;
			}

			payload.confirm_unit_type_change = true;
			payload.expected_old_purchase_unit_id =
				confirmation.oldPurchaseUnitId;
			payload.expected_new_purchase_unit_id =
				confirmation.newPurchaseUnitId;
		}

		const ingredientId =
					appsmith.store.IngForm_mode === "edit"
		? Number(appsmith.store.IngForm_edit_id) || null
		: null;

		if (
			ingredientId &&
			!unitTypeConfirmed &&
			this.unitTypeChanged(ingredientId, state.purchase_unit_id)
		) {
			try {
				const response = await apiIngGetImpactCount.run({
					ingredient_id: ingredientId
				});

				if (
					response?.authenticated !== true ||
					!response?.impact
				) {
					throw new Error("Ingredient impact could not be checked.");
				}

				const impact = response.impact;

				const recipeCount = Number(impact.recipe_count || 0);
				const dishCount = Number(impact.dish_count || 0);
				const menuCount = Number(impact.menu_count || 0);

				if (recipeCount + dishCount + menuCount > 0) {
					const units = apiIngGetIngredientLookups.data?.units || [];

					const saved = (
						apiGetMyIngredients.data?.ingredients || []
					).find(r => Number(r.id) === ingredientId);

					const oldUnit = units.find(
						u => Number(u.id) === Number(saved?.purchase_unit_id)
					);

					const newUnit = units.find(
						u => Number(u.id) === Number(state.purchase_unit_id)
					);

					await storeValue("IngUnitWarning", {
						ingredientName: state.name,
						oldUnitType: oldUnit?.unit_type || "",
						newUnitType: newUnit?.unit_type || "",
						recipeCount,
						dishCount,
						menuCount
					});

					await storeValue("IngUnitPendingSave", {
						state,
						closeAfterSave,
						ingredientId,
						oldPurchaseUnitId: Number(saved.purchase_unit_id),
						newPurchaseUnitId: Number(state.purchase_unit_id)
					});

					showModal(mdlIngUnitTypeWarning.name);
					return false;
				}

			} catch (error) {
				jsUserErrors.show(
					error,
					"Ingredient impact could not be checked."
				);
				return false;
			}
		}

		try {
			const savedRow = ingredientId === null
			? null
			: appsmith.store.IngForm_edit_row;

			if (
				ingredientId !== null &&
				Number(savedRow?.id) !== ingredientId
			) {
				showAlert(
					"Ingredient editing snapshot is unavailable. Reopen the Ingredient.",
					"warning"
				);
				return false;
			}

			if (
				ingredientId !== null &&
				(
					savedRow?.revision === null ||
					savedRow?.revision === undefined ||
					!Number.isSafeInteger(Number(savedRow.revision)) ||
					Number(savedRow.revision) < 1
				)
			) {
				showAlert(
					"Ingredient revision is unavailable. Reopen the Ingredient before saving.",
					"warning"
				);
				return false;
			}

			const result = await apiIngSave.run({
				ingredient_id: ingredientId,
				expected_revision: savedRow === null
				? null
				: Number(savedRow.revision),
				payload
			});

			const savedId = Number(result?.ingredient_id || 0);

			if (
				result?.ok !== true ||
				!savedId ||
				(ingredientId !== null && savedId !== ingredientId)
			) {
				throw new Error(
					"Ingredient Save returned an invalid or unexpected response."
				);
			}

			await storeValue("IngForm_saved_id", savedId);

			if (ingredientId !== null) {
				await jsIngBatch.clearOne(savedId);
			}

			await apiGetMyIngredients.run();

			if (!closeAfterSave) {
				const refreshed = (
					apiGetMyIngredients.data?.ingredients || []
				).find(r => Number(r.id) === savedId);

				await storeValue("IngForm_mode", "edit");
				await storeValue("IngForm_edit_id", savedId);
				await storeValue(
					"IngForm_edit_row",
					refreshed || { ...payload, id: savedId }
				);
			}

			showAlert("Ingredient saved.", "success");

			if (closeAfterSave) {
				closeModal(mdlIngUnsaved.name);
				closeModal(mdlAddIng.name);
				return true;
			}

			await this.captureBaseline();
			return true;

		} catch (error) {
			jsUserErrors.show(
				error,
				"Ingredient could not be saved."
			);
			return false;
		}
	},

	async confirmUnitTypeChange() {
		const pending = appsmith.store.IngUnitPendingSave;

		if (!pending) {
			showAlert("Unit Type confirmation is no longer available.", "warning");
			return false;
		}

		const currentId = Number(appsmith.store.IngForm_edit_id || 0);

		if (currentId !== Number(pending.ingredientId)) {
			showAlert("The Ingredient has changed. Please review it again.", "warning");
			return false;
		}

		const saved = await this.save(
			pending.closeAfterSave,
			pending.state,
			true
		);

		if (!saved) return false;

		closeModal(mdlIngUnitTypeWarning.name);

		await removeValue("IngUnitPendingSave");
		await removeValue("IngUnitWarning");

		if (appsmith.store.IngForm_save_and_new) {
			await removeValue("IngForm_save_and_new");
			await this.openAddFromIngredients();
		}

		return true;
	},

	async saveAndNew() {
		await storeValue("IngForm_save_and_new", true);

		const saved = await this.save(false);

		if (!saved) {
			if (!appsmith.store.IngUnitPendingSave) {
				await removeValue("IngForm_save_and_new");
			}
			return false;
		}

		await removeValue("IngForm_save_and_new");
		await this.openAddFromIngredients();
		return true;
	},

	// ============================================================
	// CLOSE AND UNSAVED GUARD
	// ============================================================

	async cancel() {
		if (this.isDirty()) {
			const snapshot = this.currentState();

			await storeValue("IngForm_pending_state", snapshot);
			await storeValue("IngForm_pending_action", "close");

			showModal(mdlIngUnsaved.name);
			return false;
		}

		closeModal(mdlAddIng.name);
		return true;
	},

	async saveFromUnsaved() {
		const action =
					appsmith.store.IngForm_pending_action || "close";

		const snapshot = appsmith.store.IngForm_pending_state;

		if (!snapshot) {
			showAlert(
				"Unsaved Ingredient values could not be recovered.",
				"error"
			);
			return false;
		}

		const saved = await this.save(false, snapshot);

		if (!saved) {
			return false;
		}

		closeModal(mdlIngUnsaved.name);

		if (action === "add") {
			await this.openAddFromIngredients();
		} else {
			closeModal(mdlAddIng.name);
		}

		await removeValue("IngForm_pending_state");
		await removeValue("IngForm_pending_action");

		return true;
	},

	async discardChanges() {
		const action =
					appsmith.store.IngForm_pending_action || "close";

		closeModal(mdlIngUnsaved.name);

		if (action === "add") {
			await this.openAddFromIngredients();
		} else {
			closeModal(mdlAddIng.name);
		}

		await removeValue("IngForm_pending_state");
		await removeValue("IngForm_pending_action");
		return true;
	},

	async cancelDiscard() {
		await storeValue("IngForm_restoring", true);

		closeModal(mdlIngUnsaved.name);

		await resetWidget("mdlAddIng", true);
		showModal(mdlAddIng.name);

		return true;
	},
	// ============================================================
	// DELETE
	// ============================================================

	async openDeleteConfirm() {
		const id = Number(
			appsmith.store.IngForm_edit_id || 0
		);

		if (!id) {
			showAlert(
				"This Ingredient has not been saved yet.",
				"warning"
			);
			return false;
		}

		if (!(await jsAuthSession.requireValid())) {
			return false;
		}

		try {
			const response = await apiIngGetImpactCount.run({
				ingredient_id: id
			});

			if (!response?.authenticated || !response.impact) {
				throw new Error("Ingredient impact could not be loaded.");
			}

			showModal(mdlIngDelete.name);
			return true;

		} catch (error) {
			jsUserErrors.show(
				error,
				"Ingredient impact could not be checked."
			);
			return false;
		}
	},

	async confirmDelete() {
		if (!(await jsAuthSession.requireValid())) return false;

		const id = Number(
			appsmith.store.IngForm_edit_id || 0
		);

		if (!id) {
			showAlert("No Ingredient selected.", "warning");
			return false;
		}

		try {
			const result = await apiIngDelete.run({
				ingredient_id: id
			});

			const deletedId = Number(result?.ingredient_id || 0);

			if (
				result?.authenticated !== true ||
				deletedId !== id
			) {
				throw new Error(
					"Ingredient Delete returned an invalid or unexpected response."
				);
			}

			await jsIngBatch.clearOne(id);
			await apiGetMyIngredients.run();

			closeModal(mdlIngDelete.name);
			closeModal(mdlAddIng.name);

			showAlert("Ingredient deleted.", "success");
			return true;

		} catch (error) {
			jsUserErrors.show(
				error,
				"Ingredient could not be deleted."
			);
			return false;
		}
	},

	cancelDelete() {
		closeModal(mdlIngDelete.name);
		return true;
	},

	async deleteFromList() {
		const id = Number(appsmith.store.IngList_selected_id || 0);

		const row = (apiGetMyIngredients.data?.ingredients || [])
		.find(r => Number(r.id) === id);

		if (!row) {
			showAlert("Select an ingredient to delete.", "warning");
			return false;
		}

		await storeValue(
			"IngForm_context",
			this.CONTEXT_EDIT_INGREDIENTS
		);
		await storeValue("IngForm_mode", "edit");
		await storeValue("IngForm_edit_id", row.id);
		await storeValue("IngForm_edit_row", row);

		return this.openDeleteConfirm();
	},
	// ============================================================
	// DUPLICATE NAME
	// ============================================================

	duplicateName(sourceName) {
		const baseName = String(sourceName || "").trim();

		if (!baseName) return "";

		const existingNames = new Set(
			(apiGetMyIngredients.data?.ingredients || [])
			.filter(r => r.deleted !== true)
			.map(r => String(r.name || "").trim().toLowerCase())
		);

		// If the working name is unique, keep it unchanged.
		if (!existingNames.has(baseName.toLowerCase())) {
			return baseName;
		}

		// Otherwise, generate the next available copy name.
		let candidate = `${baseName} - copy`;
		let number = 2;

		while (existingNames.has(candidate.toLowerCase())) {
			candidate = `${baseName} - copy ${number}`;
			number++;
		}

		return candidate;
	},

	// ============================================================
	// SHARED DUPLICATE WORKSPACE
	// ============================================================

	async beginDuplicate(
		sourceRow,
		allergens = [],
		dietTags = []
	) {
		if (!sourceRow?.name) {
			showAlert(
				"Ingredient could not be duplicated.",
				"warning"
			);
			return false;
		}

		const sourceId = Number(
			sourceRow.id || appsmith.store.IngForm_edit_id || 0
		);

		const duplicateRow = {
			...sourceRow,
			id: null,
			name: this.duplicateName(sourceRow.name)
		};

		await storeValue(
			"IngForm_duplicate_allergens",
			(allergens || []).map(String)
		);

		await storeValue(
			"IngForm_duplicate_diet_tags",
			(dietTags || []).map(String)
		);

		await storeValue(
			"IngForm_duplicate_row",
			duplicateRow
		);

		await storeValue(
			"IngForm_context",
			this.CONTEXT_ADD_INGREDIENTS
		);

		await storeValue("IngForm_mode", "duplicate");
		await storeValue("IngForm_edit_id", null);
		await storeValue("IngForm_edit_row", duplicateRow);

		await removeValue("IngForm_saved_id");
		await removeValue("IngForm_pending_action");

		await removeValue("IngForm_restoring");
		await removeValue("IngForm_pending_state");

		await resetWidget("mdlAddIng", true);

		// The new copy now owns the working values.
		// Clear only the original Ingredient's pending inline changes.
		if (sourceId) {
			await jsIngBatch.clearOne(sourceId);
		}

		showAlert(
			"Ingredient copied. Click Save to create the new Ingredient.",
			"info"
		);
		return true;
	},

	// ============================================================
	// DUPLICATE FROM OPEN MODAL
	// Includes unsaved changes; does not save source.
	// ============================================================

	async openDuplicateFromIngredients() {
		const sourceId = Number(
			appsmith.store.IngForm_edit_id || 0
		);

		if (!sourceId) {
			showAlert(
				"This Ingredient has not been saved yet.",
				"warning"
			);
			return false;
		}

		const current = this.currentState();

		const sourceRow = {
			...(appsmith.store.IngForm_edit_row || {}),
			...current
		};

		return this.beginDuplicate(
			sourceRow,
			current.allergens || [],
			current.diet_tags || []
		);
	},

	// ============================================================
	// DUPLICATE FROM LIST
	// ============================================================

	async duplicateFromList() {
		const id = Number(appsmith.store.IngList_selected_id || 0);

		const row = (apiGetMyIngredients.data?.ingredients || [])
		.find(r => Number(r.id) === id);

		if (!row?.id) {
			showAlert(
				"Select an ingredient to duplicate.",
				"warning"
			);
			return false;
		}

		try {
			const response = await apiIngListTags.run({
				ingredient_id: Number(row.id)
			});

			if (!response?.authenticated ||
					!Array.isArray(response.classifications)) {
				throw new Error("Ingredient classifications could not be loaded.");
			}

			const classifications = response.classifications;

			const allergens = classifications
			.filter(x => x.classification_type === "allergen")
			.map(x => String(x.helper_list_item_id));

			const dietTags = classifications
			.filter(x => x.classification_type === "diet_tag")
			.map(x => String(x.helper_list_item_id));

			const source = (
				apiGetMyIngredients.data?.ingredients || []
			).find(r => Number(r.id) === Number(row.id));

			if (!source) {
				throw new Error("Original Ingredient data could not be loaded.");
			}

			const duplicateSource = {
				...source,
				wastage_percent: source.wastage_percent
			};

			const started = await this.beginDuplicate(
				duplicateSource,
				allergens,
				dietTags
			);

			if (!started) {
				return false;
			}

			showModal(mdlAddIng.name);
			return true;

		} catch (error) {
			jsUserErrors.show(
				error,
				"Ingredient could not be duplicated."
			);
			return false;
		}
	},

	// ============================================================
	// ALLERGEN / DIET TAG DEFAULTS
	// ============================================================

	allergenDefaultValues() {
		if (appsmith.store.IngForm_restoring) {
			return appsmith.store.IngForm_pending_state?.allergens || [];
		}

		if (appsmith.store.IngForm_mode === "duplicate") {
			return appsmith.store.IngForm_duplicate_allergens || [];
		}

		if (appsmith.store.IngForm_mode === "edit") {
			return (
				apiIngListTags.data?.classifications || []
			)
				.filter(x => x.classification_type === "allergen")
				.map(x => String(x.helper_list_item_id));
		}

		return [];
	},

	dietTagDefaultValues() {
		if (appsmith.store.IngForm_restoring) {
			return appsmith.store.IngForm_pending_state?.diet_tags || [];
		}

		if (appsmith.store.IngForm_mode === "duplicate") {
			return appsmith.store.IngForm_duplicate_diet_tags || [];
		}

		if (appsmith.store.IngForm_mode === "edit") {
			return (
				apiIngListTags.data?.classifications || []
			)
				.filter(x => x.classification_type === "diet_tag")
				.map(x => String(x.helper_list_item_id));
		}

		return [];
	},

	// ============================================================
	// DISPLAY / CALCULATION
	// ============================================================

	purchaseUnitText() {
		return selIngPurchaseUnit.selectedOptionLabel || "";
	},

	usableQtyText() {
		const qty = Number(inpIngQuantity.text || 0);
		const wastage = Number(inpIngWastage.text || 0);

		if (!qty) {
			return "Usable qty: ";
		}

		const usableQty = qty * (1 - wastage / 100);
		const value = jsFmt.number(usableQty);
		const unit = this.purchaseUnitText();

		return unit
			? `Usable qty:    ${value} ${unit}`
		: `Usable qty:    ${value}`;
	},

	netCostText() {
		const qty = Number(inpIngQuantity.text || 0);
		const cost = Number(inpIngPurchaseCost.text || 0);
		const wastage = Number(inpIngWastage.text || 0);

		if (!qty || !cost) {
			return "Net cost: ";
		}

		const usableQty = qty * (1 - wastage / 100);

		if (!usableQty || usableQty <= 0) {
			return "Net cost: ";
		}

		const price = cost / usableQty;
		const formattedPrice = jsFmt.currency(price);
		const unit = this.purchaseUnitText();

		return unit
			? `Net cost:    ${formattedPrice} / ${unit}`
		: `Net cost:    ${formattedPrice}`;
	},

	purchaseUnitOptions() {
		return (
			apiIngGetIngredientLookups.data?.units || []
		).map(u => ({
			label: u.abbreviation,
			value: String(u.id)
		}));
	},

	// ============================================================
	// UNSAVED MODAL TEXT
	// ============================================================

	unsavedTitle() {
		switch (appsmith.store.IngForm_mode) {
			case "add":
				return "Unsaved Ingredient";

			case "duplicate":
				return "Unsaved Duplicate";

			default:
				return "Unsaved Changes";
		}
	},

	unsavedWarning() {
		switch (appsmith.store.IngForm_mode) {
			case "add":
				return "This new Ingredient has not been saved. Save it before closing?";

			case "duplicate":
				return "This duplicated Ingredient has not been saved. Save it before closing?";

			default:
				return "This Ingredient has unsaved changes. Save them before closing?";
		}
	}
};
