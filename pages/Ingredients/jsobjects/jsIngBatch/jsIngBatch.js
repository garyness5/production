export default {
	pending() {
		return appsmith.store.IngBatchPending || {};
	},

	count() {
		return Object.keys(this.pending()).length;
	},

	hasChanges() {
		return this.count() > 0;
	},

	savedRow(id) {
		return (apiGetMyIngredients.data?.ingredients || [])
			.find(row => String(row.id) === String(id)) || null;
	},

	sameValue(a, b, fieldName) {
		const numericFields = [
			"purchase_qty",
			"total_cost",
			"wastage_percent",
			"category_id",
			"purchase_unit_id",
			"supplier_id",
			"packaging_id"
		];

		if (numericFields.includes(fieldName)) {
			const numeric = value => {
				if (
					value === null ||
					value === undefined ||
					value === ""
				) return null;

				const n = Number(
					String(value).replaceAll(",", "").trim()
				);

				return Number.isFinite(n) ? n : value;
			};

			return numeric(a) === numeric(b);
		}

		if (fieldName === "active") {
			return Boolean(a) === Boolean(b);
		}

		return (a ?? "") === (b ?? "");
	},

	async stage(id, changes) {
		const saved = this.savedRow(id);

		if (!saved) {
			showAlert(
				"Ingredient could not be identified.",
				"error"
			);
			return false;
		}

		const all = { ...this.pending() };
		const next = { ...(all[String(id)] || {}) };

		for (const [field, value] of Object.entries(changes || {})) {
			if (this.sameValue(value, saved[field], field)) {
				delete next[field];
			} else {
				next[field] = value;
			}
		}

		if (Object.keys(next).length) {
			all[String(id)] = next;
		} else {
			delete all[String(id)];
		}

		await storeValue("IngBatchPending", all, false);
		return true;
	},

	isCellPending(id, field) {
		return Object.prototype.hasOwnProperty.call(
			this.pending()[String(id)] || {},
			field
		);
	},

	async clearOne(id) {
		const pending = { ...this.pending() };

		delete pending[String(id)];

		await storeValue(
			"IngBatchPending",
			pending,
			false
		);

		return true;
	},

	async discard() {
		await storeValue("IngBatchPending", {}, false);
		return true;
	},


	async save() {
		if (!(await jsAuthSession.requireValid())) return false;

		const pending = this.pending();

		const rows = Object.entries(pending).map(
			([id, changes]) => {
				const saved = this.savedRow(id);

				if (
					!saved ||
					!Number.isSafeInteger(Number(saved.revision)) ||
					Number(saved.revision) < 1
				) {
					throw new Error(
						"Ingredient revision is missing. Reload the Ingredient list."
					);
				}

				return {
					ingredient_id: Number(id),
					expected_revision: Number(saved.revision),
					changes
				};
			}
		);

		if (!rows.length) return true;

		try {
			const result = await apiIngBatchSave.run({ rows });

			if (
				!result?.authenticated ||
				Number(result.updated_count) !== rows.length
			) {
				throw new Error(
					"Batch save was not confirmed by the server."
				);
			}

			await this.discard();
			await apiGetMyIngredients.run();

			showAlert(
				`${rows.length} ingredient(s) updated.`,
				"success"
			);

			return true;

		} catch (e) {
			jsUserErrors.show(
				e,
				"Ingredient changes could not be saved."
			);

			return false;
		}
	}
};
