export default {
	numericValue(value) {
		if (
			value === null ||
			value === undefined ||
			value === ""
		) return null;

		const n = Number(
			String(value)
			.replaceAll(",", "")
			.replace("$", "")
			.replace("%", "")
			.trim()
		);

		return Number.isFinite(n) ? n : null;
	},

	async stageField(id, field, value) {
		if (!id) {
			showAlert("Ingredient could not be identified.", "error");
			return false;
		}

		await storeValue("IngList_selected_id", Number(id), false);

		return jsIngBatch.stage(Number(id), {
			[field]: value
		});
	},

	async stageName() {
		const row = tblIngList.updatedRow || {};
		const name = String(row.name ?? "").trim();

		if (!name) {
			showAlert(
				"Ingredient Name is required.",
				"warning"
			);
			return false;
		}

		return this.stageField(row.id, "name", name);
	},

	async stageQty() {
		const row = tblIngList.updatedRow || {};

		return this.stageField(
			row.id,
			"purchase_qty",
			this.numericValue(row.purchase_qty)
		);
	},

	async stageCost() {
		const row = tblIngList.updatedRow || {};

		return this.stageField(
			row.id,
			"total_cost",
			this.numericValue(row.total_cost)
		);
	},

	async stageCode() {
		const row = tblIngList.updatedRow || {};

		return this.stageField(
			row.id,
			"item_code",
			String(row.item_code ?? "").trim() || null
		);
	},

	async stageActive() {
		const row = tblIngList.updatedRow || {};

		if (!row.id) return false;

		await storeValue("IngList_selected_id", Number(row.id), false);

		return this.stageField(
			row.id,
			"active",
			row.active === true
		);
	},

	async stageCategory(value) {
		const row = tblIngList.updatedRow || {};

		return this.stageField(
			row.id,
			"category_id",
			value === "" || value == null
			? null
			: Number(value)
		);
	},

	async handleUnitChange(row) {
		if (row.purchase_unit === "__SET__") {
			return await this.openSetUnit(row);
		}

		return await jsIngBatch.stage(row.id, {
			purchase_unit_id: row.purchase_unit
		});
	},

	async stageSupplier(id, value) {
		return this.stageField(
			id,
			"supplier_id",
			value == null || value === ""
			? null
			: Number(value)
		);
	},

	async stagePackaging(id, value) {
		return this.stageField(
			id,
			"packaging_id",
			value == null || value === ""
			? null
			: Number(value)
		);
	},

	unitOptions(unitType) {
		const type = String(unitType || "")
		.trim()
		.toLowerCase();

		return (apiIngGetIngredientLookups.data?.units || [])
			.filter(u =>
							String(u.unit_type || "")
							.trim()
							.toLowerCase() === type
						 )
			.map(u => ({
			label: u.abbreviation,
			value: String(u.id)
		}));
	},

	async openSetUnit(row) {
		if (!row?.id) {
			showAlert(
				"Ingredient could not be identified.",
				"error"
			);
			return false;
		}

		return jsIngForm.openEditFromIngredients(row);
	},

	previewNetCost(row) {
		const qty = Number(row.purchase_qty);
		const cost = Number(row.total_cost);
		const waste = Number(row.wastage_percent ?? 0);

		if (
			!Number.isFinite(qty) ||
			!Number.isFinite(cost) ||
			!Number.isFinite(waste) ||
			qty <= 0 ||
			cost < 0 ||
			waste < 0 ||
			waste >= 100
		) {
			return null;
		}

		return cost / (qty * (1 - waste / 100));
	},

	filteredRows() {
		const rows =
					apiGetMyIngredients.data?.ingredients ?? [];

		const pending = jsIngBatch.pending();

		const workingRows = rows.map(row => {
			const changes = pending[String(row.id)] || {};
			const working = { ...row, ...changes };

			const costChanged = [
				"purchase_qty",
				"total_cost",
				"wastage_percent"
			].some(field =>
						 Object.prototype.hasOwnProperty.call(changes, field)
						);

			if (costChanged) {
				working.net_cost = this.previewNetCost(working);
			}

			return working;
		});

		const status =
					selIngListFilter.selectedOptionValue || "all";

		const search = String(
			inpIngListSearch.text || ""
		)
		.trim()
		.toLowerCase();

		return workingRows.filter(row => {
			const statusOk =
						status === "all" ||
						row.active === (status === "active");

			if (!statusOk) return false;
			if (!search) return true;

			return [
				row.name,
				row.category_name,
				row.supplier_name,
				row.packaging_name,
				row.item_code
			]
				.filter(Boolean)
				.some(value =>
							String(value)
							.toLowerCase()
							.includes(search)
						 );
		});
	}
};
