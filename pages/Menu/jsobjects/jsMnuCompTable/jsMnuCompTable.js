export default {
	minRows: 10,

	makeDraftId() {
		return "dr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
	},

	blankRow(lineNo) {
		return {
			draft_row_id: this.makeDraftId(),
			id: null,
			menu_id: Number(appsmith.store.current_menu_id || 0),
			line_no: lineNo,

			item_type: null,
			component_category: null,
			component_name: null,

			ingredient_id: null,
			child_recipe_id: null,
			child_dish_id: null,

			qty: null,
			unit_id: null,
			unit_abbreviation: null,
			unit_type: null,

			apply_wastage: true,
			active: true,

			wastage_percent: null,
			price_per_unit: null,
			cost_per_base_unit: null,
			factor_to_base: null,

			allergen_names: null,
			diet_tag_names: null,
			line_cost: null
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
				row.child_dish_id ||
				row.qty ||
				row.unit_id ||
				row.unit_abbreviation
			)
		);
	},

	prepareRow(row, lineNo) {
		return {
			...this.blankRow(lineNo),
			...row,
			draft_row_id: row?.draft_row_id || this.makeDraftId(),
			line_no: lineNo,
			menu_id: Number(appsmith.store.current_menu_id || 0),
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
		await storeValue("mnu_components_local_rows", normalized);
		return normalized;
	},

	getRows() {
		const rows = appsmith.store.mnu_components_local_rows;
		const currentMenuId = Number(appsmith.store.current_menu_id || 0);

		if (Array.isArray(rows) && rows.length > 0) {
			const contentRows = rows.filter(r => this.hasContent(r));

			const contentMenuIds = contentRows
			.map(r => Number(r.menu_id || 0))
			.filter(id => id > 0);

			if (currentMenuId > 0) {
				const belongsToCurrentMenu =
							contentMenuIds.length === 0 ||
							contentMenuIds.every(id => id === currentMenuId);

				if (belongsToCurrentMenu) {
					return rows.map((r, index) => ({
						...r,
						menu_id: currentMenuId,
						line_no: index + 1
					}));
				}
			}

			if (currentMenuId === 0 && contentMenuIds.length === 0) {
				return rows.map((r, index) => ({
					...r,
					menu_id: 0,
					line_no: index + 1
				}));
			}
		}

		return this.normalizeRows([]);
	},

	async loadFromQuery() {
		const queryRows = qryMnuGetComponents.data || [];
		return await this.setRows(queryRows);
	},

	mergeUpdatedRows() {
		const rows = this.getRows();
		const updates = tblMnuComponents.updatedRows || [];

		if (!updates.length) return rows;

		return rows.map((row, index) => {
			const update = updates.find(u =>
																	u.index === index ||
																	u.rowIndex === index ||
																	u.draft_row_id === row.draft_row_id ||
																	u.allFields?.draft_row_id === row.draft_row_id ||
																	u.updatedFields?.draft_row_id === row.draft_row_id
																 );

			if (!update) return row;

			return {
				...row,
				...(update.allFields || {}),
				...(update.updatedFields || {})
			};
		});
	},

	async syncFromTable() {
		const merged = this.mergeUpdatedRows();
		return await this.setRows(merged);
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
			child_dish_id: null,
			qty: null,
			unit_id: null,
			unit_abbreviation: null,
			unit_type: null,
			wastage_percent: null,
			price_per_unit: null,
			cost_per_base_unit: null,
			factor_to_base: null,
			allergen_names: null,
			diet_tag_names: null,
			line_cost: null,
			apply_wastage: true,
			active: true
		};
	},

	clearAfterCategory(row) {
		return {
			component_category: row.component_category || null,
			component_name: null,
			ingredient_id: null,
			child_recipe_id: null,
			child_dish_id: null,
			qty: null,
			unit_id: null,
			unit_abbreviation: null,
			unit_type: null,
			wastage_percent: null,
			price_per_unit: null,
			cost_per_base_unit: null,
			factor_to_base: null,
			allergen_names: null,
			diet_tag_names: null,
			line_cost: null,
			apply_wastage: true,
			active: true
		};
	},

	async onItemTypeChange(row) {
		return await this.patchRow(row, this.clearAfterItemType(row));
	},

	async onCategoryChange(row) {
		return await this.patchRow(row, this.clearAfterCategory(row));
	},

	async clearRows() {
		await removeValue("mnu_components_local_rows");
	},

	itemId(row) {
		if (!row) return null;

		if (row.item_type === "ingredient") return row.ingredient_id;
		if (row.item_type === "recipe") return row.child_recipe_id;
		if (row.item_type === "dish") return row.child_dish_id;

		return null;
	},

	itemKey(row) {
		if (!row?.item_type) return null;

		const id = this.itemId(row);
		if (!id) return null;

		return `${row.item_type}:${id}`;
	},

	usedItemKeys(currentRow) {
		return this.getRows()
			.filter(r => r.draft_row_id !== currentRow?.draft_row_id)
			.map(r => this.itemKey(r))
			.filter(x => x);
	},

	categoryOptions(row) {
		const itemType = row?.item_type;
		if (!itemType) return [];

		const categories = (qryMnuGetComponentItems.data || [])
		.filter(i => i.item_type === itemType)
		.map(i => i.category_name)
		.filter(x => x);

		return [...new Set(categories)]
			.sort()
			.map(x => ({ label: x, value: x }));
	},

	itemOptions(row) {
		const itemType = row?.item_type;
		if (!itemType) return [];

		const used = this.usedItemKeys(row);

		return (qryMnuGetComponentItems.data || [])
			.filter(i => i.item_type === itemType)
			.filter(i => !row?.component_category || i.category_name === row.component_category)
			.filter(i => !used.includes(`${i.item_type}:${i.id}`))
			.sort((a, b) => String(a.name).localeCompare(String(b.name)))
			.map(i => ({
			label: i.name,
			value: i.name
		}));
	},

	async onItemChange(row) {
		if (!row?.draft_row_id) return;

		await this.syncFromTable();

		const freshRow =
					this.getRows()
		.find(r => r.draft_row_id === row.draft_row_id) || row;

		const item =
					(qryMnuGetComponentItems.data || [])
		.find(i =>
					i.item_type === freshRow.item_type &&
					i.name === freshRow.component_name
				 );

		if (!item) return;

		return await this.patchRow(freshRow, {
			/*
		 * Keep:
		 * Type
		 * Category
		 * newly selected Item
		 */
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

			child_dish_id:
			item.item_type === "dish"
			? item.id
			: null,


			/*
		 * New Item means old Qty has no meaning.
		 */
			qty:
			null,


			/*
		 * New Item establishes its own default Unit.
		 *
		 * Dish uses pax presentation and therefore
		 * does not use a physical Unit ID.
		 */
			unit_id:
			item.item_type === "dish"
			? null
			: item.default_unit_id,

			unit_abbreviation:
			item.item_type === "dish"
			? "pax"
			: item.default_unit,

			unit_type:
			item.unit_type || null,


			/*
		 * Refresh current upstream Item truth.
		 */
			wastage_percent:
			item.wastage_percent,

			price_per_unit:
			item.price_per_unit,

			cost_per_base_unit:
			item.cost_per_base_unit,

			factor_to_base:
			item.factor_to_base,

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


			/*
		 * Keep the row's current local Active state.
		 */
			active:
			freshRow.active === false
			? false
			: true,


			/*
		 * Qty is blank, so no Line Cost yet.
		 */
			line_cost:
			null
		});
	},

	async clearDraftRows() {
		await removeValue("mnu_components_local_rows");
		return await this.setRows([]);
	},

	async deleteRow(row) {
		await this.syncFromTable();

		const remaining = this.getRows().filter(r =>
																						r.draft_row_id !== row.draft_row_id
																					 );

		return await this.setRows(remaining);
	},

	rowsForSave() {
		const rows =
					this.mergeUpdatedRows();

		return this.normalizeRows(rows)

		/*
		 * Only real component rows cross the
		 * Published-State boundary.
		 *
		 * A row containing only Item Type /
		 * Category is incomplete Working State,
		 * not a durable Menu component.
		 *
		 * Deleted upstream components are retained
		 * because they already represent a real
		 * saved component reference.
		 */
			.filter(r => {
			const isDeletedChild =
						r.component_status === "child_deleted" ||
						r.child_deleted === true;

			if (isDeletedChild) {
				return !!(
					r.ingredient_id ||
					r.child_recipe_id ||
					r.child_dish_id
				);
			}

			return !!(
				(r.item_type === "ingredient" && r.ingredient_id) ||
				(r.item_type === "recipe" && r.child_recipe_id) ||
				(r.item_type === "dish" && r.child_dish_id)
			);
		})

			.map((r, index) => {
			const isDeletedChild =
						r.component_status === "child_deleted" ||
						r.child_deleted === true;

			if (isDeletedChild) {
				return {
					menu_id:
					Number(
						appsmith.store.current_menu_id || 0
					),

					line_no:
					index + 1,

					item_type:
					r.item_type || null,

					ingredient_id:
					r.item_type === "ingredient"
					? Number(r.ingredient_id || 0) || null
					: null,

					child_recipe_id:
					r.item_type === "recipe"
					? Number(r.child_recipe_id || 0) || null
					: null,

					child_dish_id:
					r.item_type === "dish"
					? Number(r.child_dish_id || 0) || null
					: null,

					qty:
					r.saved_qty === "" ||
					r.saved_qty == null
					? null
					: Number(r.saved_qty),

					unit_id:
					Number(r.saved_unit_id || 0) || null,

					apply_wastage:
					r.apply_wastage === false
					? false
					: true,

					active:
					r.active === false
					? false
					: true
				};
			}

			const item =
						(qryMnuGetComponentItems.data || [])
			.find(i =>
						i.item_type === r.item_type &&
						i.name === r.component_name
					 );

			const unit =
						(qryMnuGetComponentUnits.data || [])
			.find(u =>
						u.abbreviation ===
						r.unit_abbreviation
					 );

			return {
				menu_id:
				Number(
					appsmith.store.current_menu_id || 0
				),

				line_no:
				index + 1,

				item_type:
				r.item_type || null,

				ingredient_id:
				r.item_type === "ingredient"
				? Number(
					r.ingredient_id ||
					item?.id ||
					0
				) || null
				: null,

				child_recipe_id:
				r.item_type === "recipe"
				? Number(
					r.child_recipe_id ||
					item?.id ||
					0
				) || null
				: null,

				child_dish_id:
				r.item_type === "dish"
				? Number(
					r.child_dish_id ||
					item?.id ||
					0
				) || null
				: null,

				qty:
				r.qty === "" ||
				r.qty == null
				? null
				: Number(r.qty),

				/*
				 * Dish components use pax and therefore
				 * deliberately have no physical Unit.
				 */
				unit_id:
				r.item_type === "dish"
				? null
				: (
					unit?.id ||
					r.unit_id ||
					item?.default_unit_id ||
					null
				),

				apply_wastage:
				r.apply_wastage === false
				? false
				: true,

				active:
				r.active === false
				? false
				: true
			};
		});
	},

	showRowActions(row) {
		return !!(
			row &&
			(
				row.id ||
				row.item_type ||
				row.component_category ||
				row.component_name ||
				row.ingredient_id ||
				row.child_recipe_id ||
				row.child_dish_id
			)
		);
	},

	showUseWaste(row) {
		return (
			this.showRowActions(row) &&
			row.item_type === "ingredient" &&
			Number(row.wastage_percent || 0) > 0
		);
	},

	wasteDisplay(row) {
		const waste =
					Number(row?.wastage_percent || 0);

		if (
			!row ||
			row.item_type !== "ingredient" ||
			waste <= 0
		) {
			return "";
		}

		return `${waste}%`;
	},

	itemBackground(row) {
		if (
			row?.child_deleted === true ||
			row?.component_status === "Deleted"
		) {
			return "#FFE6E6";
		}

		if (row?.child_active === false) {
			return "#FFF3CD";
		}

		return "";
	},

	unitOptions(row) {
		const unitType = row?.unit_type;

		if (!unitType) return [];

		return (qryMnuGetComponentUnits.data || [])
			.filter(u => u.unit_type === unitType)
			.map(u => ({
			label: u.abbreviation,
			value: u.abbreviation
		}));
	},

	costPerSelectedUnit(row) {
		if (
			!row ||
			row.active === false ||
			row.child_active === false ||
			row.child_deleted === true
		) {
			return null;
		}

		const componentId =
					this.itemId(row);

		if (!componentId) {
			return null;
		}

		const item =
					(qryMnuGetComponentItems.data || [])
		.find(i =>
					i.item_type === row.item_type &&
					Number(i.id) === Number(componentId)
				 );

		if (!item) {
			return null;
		}

		/*
	 * Dish Qty is servings/persons.
	 * price_per_unit means current cost per person.
	 */
		if (row.item_type === "dish") {
			return item.price_per_unit == null
				? null
			: Number(item.price_per_unit);
		}

		const units =
					qryMnuGetComponentUnits.data || [];

		const unit =
					units.find(u =>
										 u.abbreviation === row.unit_abbreviation
										) ||
					units.find(u =>
										 Number(u.id) === Number(row.unit_id || 0)
										);

		if (
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
			row.apply_wastage === true
		) {
			cost =
				cost *
				(
				1 +
				Number(item.wastage_percent || 0) / 100
			);
		}

		return cost;
	},

	lineCost(row) {
		if (
			!row ||
			row.active === false ||
			row.child_active === false ||
			row.child_deleted === true ||
			row.qty === "" ||
			row.qty == null ||
			!row.item_type ||
			!row.component_name
		) {
			return null;
		}

		/*
	 * Dish:
	 * Qty = servings/persons.
	 * No physical Unit is required.
	 */
		if (row.item_type === "dish") {
			const costPerPerson =
						this.costPerSelectedUnit(row);

			if (costPerPerson == null) {
				return null;
			}

			return Math.round(
				Number(row.qty) *
				Number(costPerPerson) *
				100
			) / 100;
		}

		/*
	 * Ingredient / Recipe still require
	 * a selected physical Unit.
	 */
		if (!row.unit_abbreviation) {
			return null;
		}

		const costPerUnit =
					this.costPerSelectedUnit(row);

		if (costPerUnit == null) {
			return null;
		}

		return Math.round(
			Number(row.qty) *
			Number(costPerUnit) *
			100
		) / 100;
	},

	subtotal() {
		const rows = this.mergeUpdatedRows();

		return rows.reduce((sum, row) => {
			const cost = this.lineCost(row);
			return sum + (cost || 0);
		}, 0);
	},

	totalCost() {
		const subtotal = this.subtotal();
		const extra = Number(inpMnuExtraPercent.text || 0);

		return Math.round((subtotal * (1 + extra / 100)) * 100) / 100;
	},

	costPerPerson() {
		const total = this.totalCost();
		const serves = Number(inpMnuServes.text || 0);

		if (!serves) return null;

		return Math.round((total / serves) * 100) / 100;
	},

	uniqueTextList(value) {
		if (!value) return [];

		return String(value)
			.split(",")
			.map(x => x.trim())
			.filter(x => x);
	},

	componentAllergenSummary() {
		const rows = this.mergeUpdatedRows();

		const items = rows.flatMap(r =>
															 this.uniqueTextList(r.allergen_names)
															);

		return [...new Set(items)].sort().join(", ");
	},

	componentDietTagSummary() {
		const rows = this.mergeUpdatedRows();

		const items = rows.flatMap(r =>
															 this.uniqueTextList(r.diet_tag_names)
															);

		return [...new Set(items)].sort().join(", ");
	},
}