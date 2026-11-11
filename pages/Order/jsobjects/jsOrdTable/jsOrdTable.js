export default {
	clean(value) {
		if (value === undefined || value === "") return null;
		if (value === null) return null;
		if (typeof value === "number") return Number(value);
		if (!isNaN(value) && value !== true && value !== false) return Number(value);
		return value;
	},

	mergedRows() {
		const rows = qryOrdGetGroceryOrder.data || [];
		const updates = tblGroOrder.updatedRows || [];

		return rows.map(row => {
			const update = updates.find(u =>
																	Number(
				u.allFields?.id ||
				u.updatedFields?.id ||
				u.id ||
				0
			) === Number(row.id || 0)
																 );

			if (!update) return row;

			return {
				...row,
				...(update.allFields || {}),
				...(update.updatedFields || {})
			};
		});
	},

	rowsForSave() {
		return this.mergedRows()
			.filter(r => r.id)
			.map(r => ({
			id: Number(r.id),
			display_required_unit_id: this.clean(r.required_unit_id),
			buy_qty: this.clean(r.buy_qty),
			buy_unit_id: this.clean(r.buy_unit_id),
			to_order: r.to_order === false ? false : true,
			purchased: r.purchased === true ? true : false,
			supplier_id: this.clean(r.supplier_id),
			packaging_id: this.clean(r.packaging_id),
			packs_to_order: this.clean(r.packs_to_order)
		}));
	},

	isDirty() {
		return (tblGroOrder.updatedRows || []).length > 0;
	},

	unitById(id) {
		return (qryOrdGetUnits.data || []).find(
			u => Number(u.id) === Number(id)
		);
	},

	convertedRequiredQty(row) {
		const storedQty = Number(
			row.stored_required_qty ?? row.required_qty ?? 0
		);

		const storedUnit = this.unitById(
			row.stored_required_unit_id ?? row.required_unit_id
		);

		const displayUnit = this.unitById(
			row.required_unit_id
		);

		if (!storedQty || !storedUnit || !displayUnit) {
			return row.required_qty;
		}

		return Math.round(
			(
				storedQty *
				Number(storedUnit.factor_to_base) /
				Number(displayUnit.factor_to_base)
			) * 100
		) / 100;
	},

	async updateAll() {
		try {
			/*
         * Save current inline Order edits first.
         * These become the manual values that may
         * survive the rebuild.
         */
			await qryOrdSaveRows.run();

			/*
         * Refresh generated Details from the current
         * saved Events / Ordered Proposals.
         */
			await qryOrdRefreshDetails.run();

			/*
         * Rebuild Order from Details.
         * Keep manual values where the Ingredient +
         * required Unit still survives.
         */
			await storeValue(
				"gro_keep_manual",
				true
			);

			await qryOrdRefreshOrder.run();

			/*
         * Reload clean saved Order state.
         */
			await qryOrdGetGroceryOrder.run();

			await resetWidget(
				"tblGroOrder",
				true
			);

			await removeValue(
				"gro_keep_manual"
			);

			showAlert(
				"Update complete. Order refreshed and Print cleared.",
				"success"
			);

			return true;

		} catch (error) {
			await removeValue(
				"gro_keep_manual"
			);

			showAlert(
				error?.message ||
				"Order could not be updated.",
				"error"
			);

			return false;
		}
	},

	filteredRows() {
		const rows = qryOrdGetGroceryOrder.data || [];

		const search = String(inpOrdSearch.text || "")
		.trim()
		.toLowerCase();

		const filter = String(selOrdFilter.selectedOptionValue || "all");

		return rows.filter(row => {

			// ----- Filter -----
			let passesFilter = true;

			switch (filter) {
				case "to_order":
					passesFilter = row.to_order === true;
					break;

				case "not_ordered":
					passesFilter = row.to_order !== true;
					break;

				case "purchased":
					passesFilter = row.purchased === true;
					break;

				case "not_purchased":
					passesFilter = row.purchased !== true;
					break;

				case "all":
				default:
					passesFilter = true;
			}

			if (!passesFilter) return false;

			// ----- Search -----
			if (!search) return true;

			return [
				row.ingredient_code,
				row.ingredient_name,
				row.category_name,
				row.supplier_name,
				row.packaging_name,
				row.required_unit,
				row.buy_unit
			]
				.some(value =>
							String(value ?? "")
							.toLowerCase()
							.includes(search)
						 );
		});
	},

	neededUnitOptions(row) {
		if (!row) {
			return [];
		}

		const currentUnit = (qryOrdGetUnits.data || [])
		.find(
			u =>
			Number(u.id) ===
			Number(row.required_unit_id)
		);

		if (!currentUnit) {
			return [];
		}

		return (qryOrdGetUnits.data || [])
			.filter(
			u =>
			String(u.unit_type || "").toLowerCase() ===
			String(currentUnit.unit_type || "").toLowerCase()
		)
			.map(
			u => ({
				label: u.abbreviation,
				value: Number(u.id)
			})
		);
	},

	async saveOrder() {
		try {
			await qryOrdSaveRows.run();
			await qryOrdGetGroceryOrder.run();

			await resetWidget(
				"tblGroOrder",
				true
			);

			await tblGroOrder.setData(
				qryOrdGetGroceryOrder.data || []
			);

			showAlert(
				"Order saved.",
				"success"
			);

			return true;

		} catch (error) {
			showAlert(
				error?.message || "Order could not be saved.",
				"error"
			);

			return false;
		}
	},

	async sendToPrint() {
		try {
			// Save any current Order edits first.
			await qryOrdSaveRows.run();

			// Replace Print from the current saved To Order rows.
			await qryOrdSendOrderToPrint.run();

			showAlert(
				"Sent to Print.",
				"success"
			);

			navigateTo("Print");

			return true;

		} catch (error) {
			showAlert(
				error?.message || "Order could not be sent to Print.",
				"error"
			);

			return false;
		}
	}
}