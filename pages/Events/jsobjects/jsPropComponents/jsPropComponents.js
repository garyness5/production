export default {
	minRows: 10,

	isLoading() {
		return appsmith.store.proposal_loading === true;
	},

	isProposalMode() {
		return jsPropData.hasSelectedProposal();
	},

	makeDraftId() {
		return (
			"pr_" +
			Date.now().toString(36) +
			"_" +
			Math.random().toString(36).slice(2, 8)
		);
	},

	numberOrNull(value) {
		if (
			value === null ||
			value === undefined ||
			value === ""
		) {
			return null;
		}

		const number = Number(value);

		return Number.isFinite(number)
			? number
		: null;
	},

	blankRow(lineNo) {
		return {
			draft_row_id: this.makeDraftId(),
			source_type: "proposal",

			id: null,

			proposal_id: Number(
				appsmith.store.current_proposal_id || 0
			),

			event_id: Number(
				appsmith.store.current_event_id || 0
			),

			event_component_id: null,

			line_no: lineNo,

			category_id: null,
			category_name: null,

			current_category_id: null,
			current_category_name: null,

			menu_id: null,
			menu_name: null,

			current_menu_name: null,
			display_menu_name: null,
			menu_renamed: false,

			guests: null,
			extra_guests: null,
			production_guests: null,

			menu_cost: null,
			frozen_cost_per_unit: null,
			line_cost: null,
			kitchen_cost: null,

			allergen_names: null,
			diet_tag_names: null,
			notes: null,

			active: true,

			current_menu_active: null,
			current_menu_deleted: null,

			component_status: "Active"
		};
	},

	hasContent(row) {
		return !!(
			row &&
			(
				row.id ||
				row.menu_id ||
				String(row.menu_name || "").trim() ||
				row.category_id ||
				String(row.category_name || "").trim() ||
				(
					row.guests !== null &&
					row.guests !== undefined &&
					row.guests !== ""
				) ||
				(
					row.extra_guests !== null &&
					row.extra_guests !== undefined &&
					row.extra_guests !== ""
				)
			)
		);
	},

	currentMenu(row) {
		const menuId = Number(row?.menu_id || 0);

		const menuName = String(
			row?.current_menu_name ||
			row?.menu_name ||
			""
		).trim();

		return (
			qryEvtGetComponentItems.data || []
		).find(item =>
					 (
			menuId > 0 &&
			Number(item.id) === menuId
		) ||
					 (
			menuId === 0 &&
			String(item.name || "").trim() ===
			menuName
		)
					);
	},

	prepareRow(row, lineNo) {
		const source = row || {};

		const guests =
					this.numberOrNull(source.guests);

		const extras =
					this.numberOrNull(source.extra_guests);

		const lineCost =
					Object.prototype.hasOwnProperty.call(
						source,
						"line_cost"
					)
		? source.line_cost
		: null;

		return {
			...this.blankRow(lineNo),
			...source,

			draft_row_id:
			source.draft_row_id ||
			this.makeDraftId(),

			source_type: "proposal",

			proposal_id: Number(
				appsmith.store.current_proposal_id || 0
			),

			event_id: Number(
				appsmith.store.current_event_id || 0
			),

			line_no: lineNo,

			category_id:
			source.category_id ?? null,

			category_name:
			source.category_name ?? null,

			current_category_id:
			source.current_category_id ?? null,

			current_category_name:
			source.current_category_name ?? null,

			menu_id:
			source.menu_id ?? null,

			menu_name:
			source.menu_name ?? null,

			current_menu_name:
			source.current_menu_name ?? null,

			display_menu_name:
			source.display_menu_name ??
			source.current_menu_name ??
			source.menu_name ??
			null,

			menu_renamed:
			source.menu_renamed === true,

			guests,

			extra_guests: extras,

			production_guests:
			guests == null
			? null
			: guests + Number(extras || 0),

			menu_cost:
			this.numberOrNull(source.menu_cost),

			frozen_cost_per_unit:
			this.numberOrNull(
				source.frozen_cost_per_unit
			),

			line_cost:
			lineCost === null ||
			lineCost === undefined ||
			lineCost === ""
			? null
			: Number(lineCost),

			kitchen_cost:
			source.kitchen_cost === null ||
			source.kitchen_cost === undefined ||
			source.kitchen_cost === ""
			? null
			: Number(source.kitchen_cost),

			allergen_names:
			source.allergen_names ?? null,

			diet_tag_names:
			source.diet_tag_names ?? null,

			notes:
			source.notes ?? null,

			active:
			source.active === false
			? false
			: true,

			current_menu_active:
			source.current_menu_active ?? null,

			current_menu_deleted:
			source.current_menu_deleted ?? null,

			component_status:
			source.component_status ||
			"Active"
		};
	},

	showRowActions(row) {
		return !!(
			row?.category_id ||
			row?.category_name ||
			row?.menu_id ||
			row?.menu_name
		);
	},

	normalizeRows(rows) {
		const realRows = (rows || [])
		.filter(row =>
						this.hasContent(row)
					 )
		.map((row, index) =>
				 this.prepareRow(
			row,
			index + 1
		)
				);

		const targetCount = Math.max(
			this.minRows,
			realRows.length + 1
		);

		while (
			realRows.length <
			targetCount
		) {
			realRows.push(
				this.blankRow(
					realRows.length + 1
				)
			);
		}

		return realRows;
	},

	queryRows() {
		const proposalId =
					Number(
						appsmith.store.current_proposal_id || 0
					);

		if (!proposalId) {
			return [];
		}

		return (
			Array.isArray(
				qryEvtGetSelectedPropMenus.data
			)
			? qryEvtGetSelectedPropMenus.data
			: []
		)
			.filter(row =>
							Number(row.proposal_id || 0) ===
							proposalId
						 )
			.map((row, index) =>
					 this.prepareRow(
			{
				...row,

				draft_row_id:
				`proposal_${row.proposal_id}_${row.id}`,

				source_type:
				"proposal",

				category_id:
				row.category_id ?? null,

				category_name:
				row.category_name ?? null,

				current_category_id:
				row.current_category_id ?? null,

				current_category_name:
				row.current_category_name ?? null,

				menu_id:
				row.menu_id ?? null,

				menu_name:
				row.menu_name ?? null,

				current_menu_name:
				row.current_menu_name ?? null,

				display_menu_name:
				row.display_menu_name ??
				row.current_menu_name ??
				row.menu_name ??
				null,

				menu_renamed:
				row.menu_renamed === true,

				menu_cost:
				row.frozen_cost_per_unit ??
				null,

				frozen_cost_per_unit:
				row.frozen_cost_per_unit ??
				null,

				line_cost:
				row.kitchen_cost ?? null,

				kitchen_cost:
				row.kitchen_cost ?? null,

				current_menu_active:
				row.current_menu_active ??
				null,

				current_menu_deleted:
				row.current_menu_deleted ??
				null,

				active:
				row.active === false
				? false
				: true
			},
			row.line_no ??
			index + 1
		)
					);
	},

	draftRows() {
		const workspace =
					jsPropWorkspaces.get();

		if (
			workspace &&
			Array.isArray(
				workspace.components
			)
		) {
			return workspace.components;
		}

		return this.normalizeRows(
			this.queryRows()
		);
	},

	rows() {
		if (
			!jsPropData.hasSelectedProposal() ||
			this.isLoading()
		) {
			return this.normalizeRows([]);
		}

		return this.draftRows();
	},

	mergeUpdatedRows() {
		const rows =
					this.draftRows();

		const updates =
					tblEvtComponents.updatedRows ||
					[];

		if (!updates.length) {
			return rows;
		}

		return rows.map(
			(row, index) => {
				const update =
							updates.find(item =>
													 item.index === index ||
													 item.rowIndex === index ||
													 item.draft_row_id ===
													 row.draft_row_id ||
													 item.allFields?.draft_row_id ===
													 row.draft_row_id ||
													 item.updatedFields?.draft_row_id ===
													 row.draft_row_id
													);

				if (!update) {
					return row;
				}

				return this.prepareRow(
					{
						...row,
						...(update.allFields || {}),
						...(update.updatedFields || {})
					},
					index + 1
				);
			}
		);
	},

	effectiveRows() {
		if (!this.isProposalMode()) {
			return this.rows();
		}

		return this.draftRows()
			.map((row, index) =>
					 this.prepareRow(
			this.refreshDerivedFields(row),
			index + 1
		)
					);
	},

	async setDraftRows(rows) {
		if (!jsPropData.hasSelectedProposal()) {
			return null;
		}

		const normalized =
					this.normalizeRows(rows);

		await jsPropWorkspaces
			.setCurrentComponents(
			normalized
		);

		return (
			jsPropWorkspaces.get()
			?.components || []
		);
	},

	async patchRow(row, patch) {
		if (!row?.draft_row_id) {
			return null;
		}

		const mergedRows =
					this.mergeUpdatedRows();

		const rows = mergedRows.map(
			(item, index) =>
			item.draft_row_id ===
			row.draft_row_id
			? this.prepareRow(
				{
					...item,
					...patch
				},
				index + 1
			)
			: this.prepareRow(
				item,
				index + 1
			)
		);

		return await this.setDraftRows(
			rows
		);
	},

	categoryOptions() {
		const categories = (
			qryEvtGetComponentItems.data || []
		)
		.filter(item =>
						item.active !== false &&
						item.deleted !== true
					 )
		.map(item => ({
			label:
			item.category_name ||
			"Uncategorized",

			value:
			item.category_name ||
			"Uncategorized"
		}));

		return [
			...new Map(
				categories.map(item => [
					item.value,
					item
				])
			).values()
		].sort((a, b) =>
					 String(a.label).localeCompare(
			String(b.label)
		)
					);
	},

	menuOptions(row) {
		const rows =
					this.isProposalMode()
		? this.draftRows()
		: this.rows();

		const usedIds = rows
		.filter(item =>
						item.draft_row_id !== row?.draft_row_id
					 )
		.map(item => {
			const resolvedMenu = this.currentMenu(item);

			return Number(
				item.menu_id ||
				resolvedMenu?.id ||
				0
			);
		})
		.filter(Boolean);

		const categoryName = String(
			row?.category_name || ""
		).trim();

		return (qryEvtGetComponentItems.data || [])
			.filter(item =>
							item.active !== false &&
							item.deleted !== true
						 )
			.filter(item =>
							!categoryName ||
							categoryName === "Uncategorized" ||
							item.category_name === categoryName
						 )
			.filter(item =>
							!usedIds.includes(Number(item.id))
						 )
			.sort((a, b) =>
						String(a.name).localeCompare(
			String(b.name)
		)
					 )
			.map(item => ({
			label: item.name,
			value: item.name
		}));
	},

	refreshDerivedFields(row) {
		const base = {
			...row,

			guests:
			this.numberOrNull(
				row?.guests
			),

			extra_guests:
			this.numberOrNull(
				row?.extra_guests
			),

			frozen_cost_per_unit:
			this.numberOrNull(
				row?.frozen_cost_per_unit
			)
		};

		const selectedMenuName =
					String(
						base.current_menu_name ||
						base.menu_name ||
						""
					).trim();

		const productionGuests =
					base.guests == null
		? null
		: (
			base.guests +
			Number(
				base.extra_guests || 0
			)
		);

		const frozenCost =
					this.numberOrNull(
						base.frozen_cost_per_unit
					);

		/*
	 * No Menu selected.
	 */
		if (
			!base.menu_id &&
			!selectedMenuName
		) {
			return {
				...base,

				menu_id: null,
				menu_name: null,

				current_menu_name: null,
				display_menu_name: null,
				menu_renamed: false,

				menu_cost: null,
				frozen_cost_per_unit:
				frozenCost,

				line_cost: null,
				kitchen_cost: null,

				production_guests:
				null,

				allergen_names: null,
				diet_tag_names: null,

				current_menu_active:
				null,

				current_menu_deleted:
				null,

				component_status:
				base.active === false
				? "Inactive"
				: "Active"
			};
		}

		const item =
					this.currentMenu(base);

		const rowInactive =
					base.active === false;

		/*
	 * With frozen_cost_per_unit cleared,
	 * jsPropComponents.refreshDerivedFields()
	 * will use the Menu's current cost.
	 */

		if (frozenCost != null) {

			const calculatedCost =
						rowInactive ||
						productionGuests == null
			? null
			: Math.round(
				productionGuests *
				frozenCost *
				100
			) / 100;

			const sourceDeleted =
						!item ||
						item.deleted === true;

			const sourceInactive =
						item?.active === false;

			return {
				...base,

				/*
			 * Preserve the saved Proposal identity.
			 */
				menu_id:
				base.menu_id,

				menu_name:
				base.menu_name,

				current_menu_name:
				item?.name ??
				base.current_menu_name ??
				base.menu_name,

				display_menu_name:
				base.menu_name ??
				item?.name ??
				null,

				menu_renamed:
				item?.name
				? (
					String(base.menu_name || "").trim() !==
					String(item.name || "").trim()
				)
				: false,

				category_id:
				base.category_id,

				category_name:
				base.category_name,

				current_category_id:
				item?.category_id ??
				base.current_category_id ??
				base.category_id,

				current_category_name:
				item?.category_name ??
				base.current_category_name ??
				base.category_name,

				menu_cost:
				frozenCost,

				frozen_cost_per_unit:
				frozenCost,

				production_guests:
				productionGuests,

				line_cost:
				calculatedCost,

				kitchen_cost:
				calculatedCost,

				/*
			 * Keep the saved Proposal summaries.
			 * Historical Event cost must not depend
			 * on today's Menu state.
			 */
				allergen_names:
				base.allergen_names ??
				null,

				diet_tag_names:
				base.diet_tag_names ??
				null,

				current_menu_active:
				sourceDeleted
				? false
				: sourceInactive
				? false
				: true,

				current_menu_deleted:
				sourceDeleted,

				component_status:
				sourceDeleted
				? "Source Deleted"
				: sourceInactive
				? "Source Inactive"
				: rowInactive
				? "Inactive"
				: "Active"
			};
		}


		/*
	 * ==================================================
	 * NEVER-FROZEN EVENT
	 *
	 * Continue using current upstream Menu truth.
	 * ==================================================
	 */

		if (!item) {
			return {
				...base,

				production_guests:
				productionGuests,

				menu_cost: null,
				line_cost: null,
				kitchen_cost: null,

				allergen_names: null,
				diet_tag_names: null,

				current_menu_active:
				null,

				current_menu_deleted:
				true,

				component_status:
				"Source Deleted"
			};
		}

		const sourceDeleted =
					item.deleted === true;

		const sourceInactive =
					item.active === false;

		if (sourceDeleted) {
			return {
				...base,

				production_guests:
				productionGuests,

				menu_cost: null,
				line_cost: null,
				kitchen_cost: null,

				allergen_names: null,
				diet_tag_names: null,

				current_menu_active:
				false,

				current_menu_deleted:
				true,

				component_status:
				"Source Deleted"
			};
		}

		const menuCost =
					this.numberOrNull(
						item.cost_per_unit ??
						item.total_cost
					);

		const calculatedCost =
					sourceInactive ||
					rowInactive ||
					productionGuests == null ||
					menuCost == null
		? null
		: Math.round(
			productionGuests *
			menuCost *
			100
		) / 100;

		return {
			...base,

			menu_id:
			item.id,

			menu_name:
			item.name,

			current_menu_name:
			item.name,

			display_menu_name:
			item.name,

			menu_renamed:
			String(base.menu_name || "").trim() !==
			String(item.name || "").trim(),

			category_id:
			item.category_id ?? null,

			category_name:
			item.category_name ?? null,

			current_category_id:
			item.category_id ?? null,

			current_category_name:
			item.category_name ?? null,

			menu_cost:
			menuCost,

			frozen_cost_per_unit:
			null,

			production_guests:
			productionGuests,

			line_cost:
			calculatedCost,

			kitchen_cost:
			calculatedCost,

			allergen_names:
			item.allergen_names ??
			item.derived_allergens ??
			null,

			diet_tag_names:
			item.diet_tag_names ??
			item.derived_diet_tags ??
			null,

			current_menu_active:
			sourceInactive
			? false
			: true,

			current_menu_deleted:
			false,

			component_status:
			sourceInactive
			? "Source Inactive"
			: rowInactive
			? "Inactive"
			: "Active"
		};
	},

	async onCategoryChange(row) {
		if (!row?.draft_row_id) {
			return null;
		}

		const mergedRows =
					this.mergeUpdatedRows();

		const freshRow =
					mergedRows.find(item =>
													item.draft_row_id === row.draft_row_id
												 ) || row;

		const categoryName =
					String(
						freshRow.category_name || ""
					).trim() || null;

		const category = (
			qryEvtGetComponentItems.data || []
		).find(item =>
					 (
			item.category_name ||
			"Uncategorized"
		) ===
					 (
			categoryName ||
			"Uncategorized"
		)
					);

		const result =
					await this.patchRow(
						freshRow,
						{
							category_id:
							category?.category_id ??
							null,

							category_name:
							categoryName,

							current_category_id:
							category?.category_id ??
							null,

							current_category_name:
							categoryName,

							menu_id: null,
							menu_name: null,

							current_menu_name: null,
							display_menu_name: null,
							menu_renamed: false,

							menu_cost: null,
							line_cost: null,
							kitchen_cost: null,

							allergen_names: null,
							diet_tag_names: null,

							current_menu_active: null,
							current_menu_deleted: null,

							component_status:
							freshRow.active === false
							? "Inactive"
							: "Active"
						}
					);

		return result;
	},

	async onMenuChange(row) {
		if (!row?.draft_row_id) {
			return null;
		}

		const mergedRows =
					this.mergeUpdatedRows();

		const freshRow =
					mergedRows.find(item =>
													item.draft_row_id ===
													row.draft_row_id
												 ) || row;

		const selectedName =
					String(
						freshRow.menu_name || ""
					).trim();

		const duplicateExists =
					mergedRows.some(item =>
													item.draft_row_id !== freshRow.draft_row_id &&
													(
						Number(item.menu_id || 0) > 0
						? Number(item.menu_id) ===
						Number(
							(
								qryEvtGetComponentItems.data || []
							).find(menu =>
										 String(menu.name || "").trim() ===
										 selectedName
										)?.id || 0
						)
						: String(item.menu_name || "").trim() ===
						selectedName
					)
												 );

		if (duplicateExists) {
			showAlert(
				"This Menu is already in the Proposal.",
				"warning"
			);

			const result =
						await this.patchRow(
							freshRow,
							{
								menu_id: null,
								menu_name: null,
								current_menu_name: null,
								display_menu_name: null,
								menu_renamed: false,
								menu_cost: null,
								line_cost: null,
								kitchen_cost: null,
								allergen_names: null,
								diet_tag_names: null,
								current_menu_active: null,
								current_menu_deleted: null
							}
						);

			return result;
		}

		if (!selectedName) {
			const result =
						await this.patchRow(
							freshRow,
							this.refreshDerivedFields({
								...freshRow,

								menu_id: null,
								menu_name: null,

								current_menu_name: null,
								display_menu_name: null,

								menu_renamed: false
							})
						);

			return result;
		}

		const item = (
			qryEvtGetComponentItems.data ||
			[]
		).find(menu =>
					 menu.active !== false &&
					 menu.deleted !== true &&
					 String(
			menu.name || ""
		).trim() ===
					 selectedName
					);

		if (!item) {
			return null;
		}

		const selectedRow = {
			...freshRow,

			menu_id:
			item.id,

			menu_name:
			item.name,

			current_menu_name:
			item.name,

			display_menu_name:
			item.name,

			menu_renamed:
			false,

			category_id:
			item.category_id ??
			null,

			category_name:
			item.category_name ??
			null,

			current_category_id:
			item.category_id ??
			null,

			current_category_name:
			item.category_name ??
			null,

			current_menu_active:
			true,

			current_menu_deleted:
			false,

			active:
			freshRow.active === false
			? false
			: true
		};

		const result =
					await this.patchRow(
						freshRow,
						this.refreshDerivedFields(
							selectedRow
						)
					);

		return result;
	},

	lineCostDisplay(row) {
		const value =
					this.lineCost(row);

		return value == null
			? ""
		: jsFmt.currency(value);
	},

	async onActiveChange(row) {
		if (!row?.draft_row_id) {
			return null;
		}

		/*
	 * Checkbox onChange fires before Appsmith finishes
	 * updating tblEvtComponents.updatedRows.
	 */
		await new Promise(resolve =>
											setTimeout(resolve, 0)
										 );

		const mergedRows =
					this.mergeUpdatedRows();

		const rows = mergedRows.map(
			(item, index) =>
			this.prepareRow(
				this.refreshDerivedFields(item),
				index + 1
			)
		);

		return await this.setDraftRows(rows);
	},

	async deleteRow(row) {
		if (!row?.draft_row_id) {
			return null;
		}

		const mergedRows =
					this.mergeUpdatedRows();

		const remaining =
					mergedRows.filter(item =>
														item.draft_row_id !==
														row.draft_row_id
													 );

		return await this.setDraftRows(
			remaining
		);
	},

	lineCost(row) {
		if (!row?.menu_id) {
			return null;
		}

		return this.refreshDerivedFields(
			row
		).line_cost;
	},

	toProduce() {
		return this.effectiveRows()
			.reduce(
			(sum, row) => {
				if (
					row.active === false ||
					row.current_menu_deleted === true
				) {
					return sum;
				}

				return (
					sum +
					Number(
						row.guests || 0
					) +
					Number(
						row.extra_guests || 0
					)
				);
			},
			0
		);
	},

	totalCost() {
		const total =
					this.effectiveRows()
		.reduce(
			(sum, row) =>
			sum +
			Number(
				row.line_cost || 0
			),
			0
		);

		return Math.round(
			total * 100
		) / 100;
	},
	async captureEditedRows() {
		if (!jsPropData.hasSelectedProposal()) {
			return null;
		}

		const rows =
					this.normalizeRows(
						this.mergeUpdatedRows()
					);

		return await jsPropWorkspaces
			.setCurrentComponents(rows);
	},
};