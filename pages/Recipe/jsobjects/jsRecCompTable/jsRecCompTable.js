export default {
	componentItems() {
		return (apiRecGetComponentItems.data?.component_items || [])
			.map(item => ({
			...item,
			id: Number(item.item_id),
			default_unit_id: Number(item.unit_id) || null,
			default_unit: item.unit_abbreviation,
			cost_per_base_unit:
			item.cost_per_base_unit == null
			? null
			: Number(item.cost_per_base_unit),
			wastage_percent: Number(item.wastage_percent || 0)
		}));
	},

	componentUnits() {
		return (appsmith.store.rec_units || [])
			.map(unit => ({
			...unit,
			id: Number(unit.id),
			factor_to_base: Number(unit.factor_to_base)
		}));
	},

	minRows: 10,

	makeDraftId() {
		return "dr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
	},

	blankRow(lineNo) {
		return {
			draft_row_id: this.makeDraftId(),
			id: null,
			recipe_id: Number(appsmith.store.current_recipe_id || 0),
			line_no: lineNo,

			item_type: null,
			component_category: null,
			component_name: null,

			ingredient_id: null,
			child_recipe_id: null,

			qty: null,
			unit_id: null,
			unit_abbreviation: null,
			unit_type: null,

			apply_wastage: true,
			active: true,

			cost_per_base_unit: null,
			factor_to_base: null,
			line_cost: null,


			wastage_percent: null,

			allergen_names: null,
			diet_tag_names: null,

			child_active: true,
			child_deleted: false,
			component_status: "active",

			created_at: null,
			updated_at: null,

			saved_qty: null,
			saved_unit_id: null,
			saved_unit_abbreviation: null
		};
	},

	hasContent(row) {
		return !!(
			row &&
			(
				row.id ||
				row.item_type ||
				row.component_category ||
				row.component_name ||
				row.ingredient_id ||
				row.child_recipe_id ||
				row.qty ||
				row.unit_id ||
				row.unit_abbreviation
			)
		);
	},

	prepareRow(row, lineNo) {
		const itemId =
					row?.item_type === "ingredient"
		? row?.ingredient_id
		: row?.child_recipe_id;

		const upstream = this.componentItems().find(item =>
																								item.item_type === row?.item_type &&
																								Number(item.id) === Number(itemId) &&
																								itemId != null
																							 );

		return {
			...this.blankRow(lineNo),
			...row,

			// Refresh compatibility from the current upstream item.
			// Never restore a deliberately cleared selected Unit.
			unit_type: upstream?.unit_type ?? row?.unit_type ?? null,

			draft_row_id: row?.draft_row_id || this.makeDraftId(),
			line_no: lineNo,
			recipe_id: Number(appsmith.store.current_recipe_id || 0),
			apply_wastage: row?.apply_wastage === false ? false : true,
			active: row?.active === false ? false : true
		};
	},

	normalizeRows(rows) {
		const realRows = (rows || [])
		.filter(r => this.hasContent(r))
		.map((r, index) => this.prepareRow(r, index + 1));

		const targetCount = Math.max(this.minRows, realRows.length + 1);

		while (realRows.length < targetCount) {
			realRows.push(this.blankRow(realRows.length + 1));
		}

		return realRows;
	},

	async setRows(rows) {
		const normalized = this.normalizeRows(rows);

		await storeValue(
			"rec_components_local_rows",
			normalized
		);

		return normalized;
	},

	getRows() {
		const rows =
					appsmith.store.rec_components_local_rows || [];

		const currentRecipeId =
					Number(appsmith.store.current_recipe_id || 0);

		if (
			Array.isArray(rows) &&
			rows.length > 0
		) {
			return rows.map((r, index) => ({
				...r,
				recipe_id: currentRecipeId,
				line_no: index + 1
			}));
		}

		return this.normalizeRows([]);
	},

	async loadFromQuery() {
		const rows = apiRecGetDetail.data?.components || [];
		return await this.setRows(rows);
	},

	mergeUpdatedRows() {
		const rows = this.getRows();
		const updates = tblRecComponents.updatedRows || [];

		if (!updates.length) {
			return rows;
		}

		return rows.map((row, index) => {
			const update = updates.find(u => {
				const fields = {
					...(u.allFields || {}),
					...(u.updatedFields || {})
				};

				if (
					fields.draft_row_id &&
					fields.draft_row_id === row.draft_row_id
				) {
					return true;
				}

				if (
					fields.id != null &&
					row.id != null &&
					Number(fields.id) === Number(row.id)
				) {
					return true;
				}

				return (
					u.index === index ||
					u.rowIndex === index
				);
			});

			if (!update) {
				return row;
			}

			return {
				...row,
				...(update.allFields || {}),
				...(update.updatedFields || {})
			};
		});
	},

	async syncFromTable() {
		const merged = this.mergeUpdatedRows();

		await this.setRows(merged);

		await jsRecWorkspace.capture();

		return this.getRows();
	},

	async patchRow(row, patch) {
		if (!row?.draft_row_id) return;

		await this.syncFromTable();

		const rows = this.getRows().map(r =>
																		r.draft_row_id === row.draft_row_id
																		? { ...r, ...patch }
																		: r
																	 );

		return await this.setRows(rows);
	},

	clearAfterItemType(row) {
		return {
			item_type: row.item_type || null,
			component_category: null,
			component_name: null,

			ingredient_id: null,
			child_recipe_id: null,

			qty: null,
			unit_id: null,
			unit_abbreviation: null,
			unit_type: null,

			wastage_percent: null,
			cost_per_base_unit: null,
			factor_to_base: null,
			line_cost: null,

			allergen_names: null,
			diet_tag_names: null,

			child_active: true,
			child_deleted: false,
			component_status: "active",

			apply_wastage: true,
			active: true
		};
	},

	clearAfterCategory(row) {
		const cleared =
					this.clearAfterItemType(row);

		return {
			...cleared,
			item_type:
			row?.item_type || null,
			component_category:
			row?.component_category || null
		};
	},

	editRow(row) {
		if (!row) return null;

		return {
			...(row.allFields || {}),
			...(row.updatedFields || {}),
			...(
				!row.allFields &&
				!row.updatedFields
				? row
				: {}
			)
		};
	},

	async onItemTypeChange(row) {
		const editRow =
					this.editRow(row);

		if (!editRow?.draft_row_id) {
			return false;
		}

		return await this.patchRow(
			editRow,
			this.clearAfterItemType(editRow)
		);
	},

	async onCategoryChange(row) {
		const editRow =
					this.editRow(row);

		if (!editRow?.draft_row_id) {
			return false;
		}

		return await this.patchRow(
			editRow,
			this.clearAfterCategory(editRow)
		);
	},

	async clearRows() {
		return await this.setRows([]);
	},

	itemKey(row) {
		if (!row?.item_type) return null;

		const id =
					row.item_type === "ingredient"
		? row.ingredient_id
		: row.child_recipe_id;

		if (!id) return null;

		return `${row.item_type}:${id}`;
	},

	usedItemKeys(currentRow) {
		return this.getRows()
			.filter(r =>
							r.draft_row_id !== currentRow?.draft_row_id
						 )
			.map(r => this.itemKey(r))
			.filter(Boolean);
	},

	categoryOptions(row) {
		const itemType = row?.item_type;
		if (!itemType) return [];

		const categories =
					this.componentItems()
		.filter(i =>
						i.item_type === itemType
					 )
		.map(i =>
				 i.category_name
				)
		.filter(Boolean);

		return [...new Set(categories)]
			.sort()
			.map(x => ({
			label: x,
			value: x
		}));
	},

	itemOptions(row) {
		const itemType = row?.item_type;
		if (!itemType) return [];

		const used = this.usedItemKeys(row);

		return this.componentItems()
			.filter(i =>
							i.item_type === itemType
						 )
			.filter(i =>
							!row?.component_category ||
							i.category_name === row.component_category
						 )
			.filter(i =>
							!used.includes(
			`${i.item_type}:${i.id}`
		)
						 )
			.sort((a, b) =>
						String(a.name).localeCompare(
			String(b.name)
		)
					 )
			.map(i => ({
			label: i.name,
			value: i.name
		}));
	},

	async onItemChange(row) {
		const editRow =
					this.editRow(row);

		if (!editRow?.draft_row_id) {
			return false;
		}

		await this.syncFromTable();

		const freshRow =
					this.getRows().find(r =>
															r.draft_row_id ===
															editRow.draft_row_id
														 ) || editRow;

		const item =
					this.componentItems()
		.find(i =>
					i.item_type ===
					freshRow.item_type &&
					i.name ===
					freshRow.component_name
				 );

		if (!item) {
			return false;
		}

		return await this.patchRow(
			freshRow,
			{
				item_type:
				item.item_type,

				component_category:
				item.category_name,

				component_name:
				item.name,

				ingredient_id:
				item.item_type === "ingredient"
				? item.id
				: null,

				child_recipe_id:
				item.item_type === "recipe"
				? item.id
				: null,

				qty:
				null,

				unit_id:
				item.default_unit_id,

				unit_abbreviation:
				item.default_unit,

				unit_type:
				item.unit_type,

				wastage_percent:
				item.wastage_percent,

				allergen_names:
				item.allergen_names,

				diet_tag_names:
				item.diet_tag_names,

				child_deleted:
				false,

				child_active:
				true,

				component_status:
				"active",

				apply_wastage:
				true,

				active:
				true
			}
		);
	},

	itemBackground(row) {
		if (
			row?.child_deleted === true ||
			row?.component_status === "child_deleted"
		) {
			return "#FFE6E6";
		}

		if (
			row?.child_active === false ||
			row?.component_status === "inactive"
		) {
			return "#FFF3CD";
		}

		return "";
	},

	async deleteRow(row) {
		const target =
					this.editRow(row);

		if (!target) {
			return false;
		}

		const rows =
					this.mergeUpdatedRows();

		const remaining =
					rows.filter(r => {
						if (target.draft_row_id) {
							return (
								r.draft_row_id !==
								target.draft_row_id
							);
						}

						if (target.id) {
							return (
								Number(r.id || 0) !==
								Number(target.id)
							);
						}

						return (
							Number(r.line_no || 0) !==
							Number(target.line_no || 0)
						);
					});

		await this.setRows(remaining);

		return true;
	},

	unitOptions(row) {
		const unitType = row?.unit_type;

		if (!unitType) return [];

		return this.componentUnits()
			.filter(u => u.unit_type === unitType)
			.map(u => ({
			label: u.abbreviation,
			value: String(u.id)
		}));
	},

	showUseWaste(row) {
		return !!(
			row?.item_type === "ingredient" &&
			this.showRowActions(row)
		);
	},

	pricePerUnit(row) {
		if (
			!row ||
			row.active === false ||
			row.child_active === false ||
			row.child_deleted === true ||
			!row.item_type
		) {
			return null;
		}

		const itemId =
					row.item_type === "ingredient"
		? Number(row.ingredient_id || 0)
		: Number(row.child_recipe_id || 0);

		if (!itemId) return null;

		const item = this.componentItems().find(i =>
																						i.item_type === row.item_type &&
																						Number(i.id) === itemId
																					 );

		const unit = this.componentUnits().find(u =>
																						Number(u.id) === Number(row.unit_id)
																					 );

		if (
			!item ||
			!unit ||
			item.cost_per_base_unit == null ||
			unit.factor_to_base == null
		) {
			return null;
		}

		let cost =
				Number(item.cost_per_base_unit) *
				Number(unit.factor_to_base);

		if (
			row.item_type === "ingredient" &&
			row.apply_wastage === false
		) {
			cost *=
				1 - Number(item.wastage_percent || 0) / 100;
		}

		return Math.round(cost * 10000) / 10000;
	},

	lineCost(row) {
		if (
			!row ||
			row.qty === "" ||
			row.qty == null
		) {
			return null;
		}

		const pricePerUnit =
					this.pricePerUnit(row);

		if (pricePerUnit == null) {
			return null;
		}

		return Math.round(
			Number(row.qty) *
			Number(pricePerUnit) *
			100
		) / 100;
	},

	subtotal() {
		const rows = this.mergeUpdatedRows();

		return rows.reduce(
			(sum, row) =>
			sum + (this.lineCost(row) || 0),
			0
		);
	},

	totalCost() {
		const subtotal = this.subtotal();
		const extra =
					Number(inpRecExtraPercent.text || 0);

		return Math.round(
			subtotal *
			(1 + extra / 100) *
			100
		) / 100;
	},

	costPerYieldUnit() {
		const total = this.totalCost();
		const yieldQty =
					Number(inpRecYieldQty.text || 0);

		if (!yieldQty) return null;

		return Math.round(
			(total / yieldQty) * 100
		) / 100;
	},

	uniqueTextList(value) {
		if (!value) return [];

		return String(value)
			.split(",")
			.map(x => x.trim())
			.filter(Boolean);
	},

	componentAllergenSummary() {
		const rows = this.mergeUpdatedRows();

		const items =
					rows.flatMap(r =>
											 this.uniqueTextList(r.allergen_names)
											);

		return [...new Set(items)]
			.sort()
			.join(", ");
	},

	componentDietTagSummary() {
		const rows = this.mergeUpdatedRows();

		const items =
					rows.flatMap(r =>
											 this.uniqueTextList(r.diet_tag_names)
											);

		return [...new Set(items)]
			.sort()
			.join(", ");
	},

	showRowActions(row) {
		return !!(
			row?.ingredient_id ||
			row?.child_recipe_id ||
			row?.component_name
		);
	}
};