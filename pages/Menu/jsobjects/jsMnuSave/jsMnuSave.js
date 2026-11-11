export default {
	pendingAction: null,

	async safeReset(widgetName) {
		try {
			await resetWidget(widgetName, true);
		} catch (e) {
			return null;
		}
	},

	saveSnapshot() {
		return (
			appsmith.store.menu_save_snapshot ||
			jsMnuWorkspace.current()
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

			child_dish_id:
			row.item_type === "dish"
			? Number(row.child_dish_id) || null
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

	async saveMenu() {
		try {
			await jsMnuCompTable.syncFromTable();

			const snapshot =
						jsMnuWorkspace.current();

			const name =
						String(
							snapshot?.header?.name || ""
						).trim();

			if (!name) {
				showAlert(
					"Menu Name is required before you can save.",
					"warning"
				);

				return false;
			}

			await storeValue(
				"menu_save_snapshot",
				snapshot
			);

			const result =
						await qryMnuSaveMenu.run();

			const savedId =
						Number(
							result?.[0]?.menu_id || 0
						);

			if (!savedId) {
				showAlert(
					"Menu was not saved.",
					"error"
				);

				return false;
			}

			await storeValue(
				"current_menu_id",
				savedId
			);

			await Promise.all([
				qryMnuGetItemById.run(),
				qryMnuGetSelectedDietTags.run(),
				qryMnuGetComponents.run()
			]);

			await jsMnuCompTable.loadFromQuery();

			await jsMnuWorkspace.initializeFromSaved();

			await removeValue(
				"menu_save_snapshot"
			);

			await storeValue(
				"Menu_mode",
				"edit"
			);

			await removeValue(
				"Menu_open_mode"
			);

			showAlert(
				"Menu saved.",
				"success"
			);

			return true;

		} catch (error) {
			await removeValue(
				"menu_save_snapshot"
			);

			showAlert(
				error?.message ||
				"Menu was not saved.",
				"error"
			);

			return false;
		}
	},

	async startNewMenu() {
		await removeValue("current_menu_id");

		await storeValue("Menu_mode", "add");
		await storeValue("Menu_open_mode", "add");

		await jsMnuWorkspace.initializeNew();
		await jsMnuCompTable.clearRows();

		await resetWidget("inpMnuName", true);
		await resetWidget("selMnuCategory", true);
		await resetWidget("chkMnuActive", true);
		await resetWidget("inpMnuServes", true);
		await resetWidget("inpMnuExtraPercent", true);
		await resetWidget("msMnuDietTags", true);
		await resetWidget("rteMnuNotes", true);

		return true;
	},

	async addMenu() {
		if (!this.isDirty()) {
			return await this.startNewMenu();
		}

		this.pendingAction = "add";

		showModal(mdlMnuUnsavedChanges.name);

		return true;
	},

	async addWithoutSaving() {
		closeModal(
			mdlMnuUnsavedChanges.name
		);

		this.pendingAction = null;

		await jsMnuWorkspace.discard();

		return await this.startNewMenu();
	},

	async saveAndAddMenu() {
		closeModal(
			mdlMnuUnsavedChanges.name
		);

		const saved =
					await this.saveMenu();

		if (!saved) {
			return false;
		}

		this.pendingAction = null;

		return await this.startNewMenu();
	},

	clean(value) {
		if (value === undefined || value === "") return null;
		if (typeof value === "number") return Number(value);
		if (!isNaN(value) && value !== null && value !== true && value !== false) return Number(value);
		return value;
	},

	textClean(value) {
		const text = String(value || "").trim();
		return text || null;
	},

	headerSnapshotFromPage() {
		return {
			name: this.textClean(inpMnuName.text),
			category_id: this.clean(
				selMnuCategory.selectedOptionValue
			),
			active:
			chkMnuActive.isChecked === false
			? false
			: true,
			yield_qty:
			this.clean(inpMnuServes.text),
			extra_percent:
			this.clean(inpMnuExtraPercent.text),
			notes:
			this.textClean(rteMnuNotes.value)
		};
	},

	headerSnapshotFromSaved() {
		const r = Array.isArray(qryMnuGetItemById.data)
		? qryMnuGetItemById.data[0]
		: qryMnuGetItemById.data;

		if (!r) {
			return {
				name: null,
				category_id: null,
				active: true,
				yield_qty: null,
				extra_percent: 0,
				notes: null
			};
		}

		return {
			name: this.textClean(r.name),
			category_id: this.clean(r.category_id),
			active: r.active === false ? false : true,
			yield_qty: this.clean(r.yield_qty),
			extra_percent: this.clean(r.extra_percent),
			notes: this.textClean(r.notes)
		};
	},

	componentSnapshot(rows) {
		return (rows || [])
			.filter(r => r.item_type && (r.ingredient_id || r.child_recipe_id || r.child_dish_id))
			.map((r, index) => ({
			line_no: index + 1,
			item_type: r.item_type || null,
			ingredient_id: r.item_type === "ingredient" ? this.clean(r.ingredient_id) : null,
			child_recipe_id: r.item_type === "recipe" ? this.clean(r.child_recipe_id) : null,
			child_dish_id: r.item_type === "dish" ? this.clean(r.child_dish_id) : null,
			qty: this.clean(r.saved_qty ?? r.qty),
			unit_id: this.clean(r.saved_unit_id ?? r.unit_id),
			apply_wastage: r.apply_wastage === false ? false : true,
			active: r.active === false ? false : true
		}));
	},

	currentComponentSnapshot() {
		return this.componentSnapshot(jsMnuCompTable.rowsForSave());
	},

	savedComponentSnapshot() {
		return this.componentSnapshot(qryMnuGetComponents.data || []);
	},

	isNewBlankMenu() {
		return Number(appsmith.store.current_menu_id || 0) === 0 &&
			!this.headerSnapshotFromPage().name &&
			!this.headerSnapshotFromPage().category_id &&
			this.currentComponentSnapshot().length === 0;
	},

	dietTagSnapshotFromPage() {
		return (msMnuDietTags.selectedOptionValues || [])
			.map(x => Number(x))
			.filter(x => x)
			.sort((a, b) => a - b);
	},

	dietTagSnapshotFromSaved() {
		return (qryMnuGetSelectedDietTags.data || [])
			.map(r => Number(r.value ?? r.helper_list_item_id ?? r.tag_id))
			.filter(x => x)
			.sort((a, b) => a - b);
	},

	isDirty() {
		if (this.isNewBlankMenu()) return false;

		return (
			JSON.stringify(this.headerSnapshotFromPage()) !== JSON.stringify(this.headerSnapshotFromSaved()) ||
			JSON.stringify(this.currentComponentSnapshot()) !== JSON.stringify(this.savedComponentSnapshot()) ||
			JSON.stringify(this.dietTagSnapshotFromPage()) !== JSON.stringify(this.dietTagSnapshotFromSaved())
		);
	},

	async closeMenu() {
		await jsMnuCompTable.syncFromTable();

		if (this.isDirty()) {
			this.pendingAction = "close";

			showModal(
				mdlMnuUnsavedChanges.name
			);

			return true;
		}

		navigateTo("MenuList");

		return true;
	},

	async saveAndCloseMenu() {
		const result =
					await this.saveMenu();

		if (!result) return false;

		this.pendingAction = null;

		closeModal(
			mdlMnuUnsavedChanges.name
		);

		navigateTo("MenuList");

		return true;
	},

	async closeWithoutSaving() {
		this.pendingAction = null;

		closeModal(
			mdlMnuUnsavedChanges.name
		);

		await jsMnuCompTable.clearDraftRows();

		navigateTo("MenuList");

		return true;
	},

	async nextDuplicateName(sourceName) {
		const baseName =
					String(sourceName || "").trim();

		await qryMnuGetNames.run();

		const existing =
					new Set(
						(qryMnuGetNames.data || [])
						.map(x =>
								 String(x.name || "")
								 .trim()
								 .toLowerCase()
								)
					);

		let candidate =
				`${baseName} - copy`;

		let number = 2;

		while (
			existing.has(candidate.toLowerCase())
		) {
			candidate =
				`${baseName} - copy ${number}`;

			number++;
		}

		return candidate;
	},

	async duplicateMenu() {
		const sourceId =
					Number(
						appsmith.store.current_menu_id || 0
					);

		if (!sourceId) {
			showAlert(
				"This Menu has not been saved yet.",
				"warning"
			);

			return false;
		}

		const source =
					await jsMnuWorkspace.capture();

		const currentName =
					String(
						source.header.name || ""
					).trim();

		const duplicateName =
					await this.nextDuplicateName(currentName);

		const duplicate = {
			header: {
				...source.header,
				name: duplicateName
			},

			diet_tags: [
				...(source.diet_tags || [])
			],

			components:
			(source.components || [])
			.map(row => ({
				...row,
				id: null,
				menu_id: 0,
				draft_row_id:
				jsMnuCompTable.makeDraftId()
			}))
		};

		await storeValue(
			"current_menu_id",
			0
		);

		await storeValue(
			"Menu_mode",
			"duplicate"
		);

		await removeValue(
			"Menu_open_mode"
		);

		await jsMnuWorkspace.initializeDuplicate(
			duplicate
		);

		await jsMnuCompTable.setRows(
			duplicate.components
		);

		await this.safeReset("inpMnuName");
		await this.safeReset("selMnuCategory");
		await this.safeReset("chkMnuActive");
		await this.safeReset("inpMnuServes");
		await this.safeReset("inpMnuExtraPercent");
		await this.safeReset("rteMnuNotes");
		await this.safeReset("tblMnuComponents");

		return true;
	},

	async deleteMenuStart() {
		if (this.isDirty()) {
			await storeValue("pendingMenuAction", "delete");
			showModal(mdlMnuUnsavedChanges.name);
			return false;
		}

		await qryMnuGetImpactCount.run();
		showModal(mdlMnuDelete.name);
		return true;
	},

	async deleteMenuConfirm() {
		await qryMnuDeleteMenu.run();

		closeModal(mdlMnuDelete.name);
		closeModal(mdlMnuUnsavedChanges.name);

		await jsMnuCompTable.clearDraftRows();
		await removeValue("mnu_components_local_rows");
		await storeValue("current_menu_id", 0);

		showAlert("Menu deleted", "success");
		navigateTo("MenuList");

		return true;
	},

	impactEventCount() {
		return Number(
			qryMnuGetImpactCount.data?.[0]?.event_count || 0
		);
	},

	deleteImpactText() {
		return `This will impact
    Events: ${this.impactEventCount()}`;
	},

	showDeleteImpact() {
		return this.impactEventCount() > 0;
	},

	async saveAndDeleteMenu() {
		const saved = await this.saveMenu();
		if (!saved) return false;

		closeModal(mdlMnuUnsavedChanges.name);

		await qryMnuGetImpactCount.run();
		showModal(mdlMnuDelete.name);

		return true;
	},

	async deleteWithoutSaving() {
		closeModal(mdlMnuUnsavedChanges.name);

		await qryMnuGetImpactCount.run();
		showModal(mdlMnuDelete.name);

		return true;
	},

	async unsavedYes() {
		switch (this.pendingAction) {
			case "close":
				return await this.saveAndCloseMenu();

			case "add":
				return await this.saveAndAddMenu();

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
	}
}