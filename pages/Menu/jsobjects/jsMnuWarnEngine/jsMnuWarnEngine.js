export default {
	count(rows, predicate) {
		return (rows || []).filter(predicate).length;
	},

	plural(count, singular, plural) {
		return count === 1 ? singular : plural;
	},

	hasValue(value) {
		return value !== null && value !== undefined && value !== "";
	},

	hasItem(row) {
		return (
			this.hasValue(row.ingredient_id) ||
			this.hasValue(row.child_recipe_id) ||
			this.hasValue(row.child_dish_id)
		);
	},

	buildWarnings(config = {}) {
		const rows = config.rows || [];
		const parentLabel = config.parentLabel || "Item";
		const parentActive = config.parentActive;
		const parentYieldQty = config.parentYieldQty;
		const parentYieldUnit = config.parentYieldUnit;

		const warnings = [];

		if (parentActive === false) {
			warnings.push(`${parentLabel} is inactive`);
		}

		if (!this.hasValue(parentYieldQty) || !this.hasValue(parentYieldUnit)) {
			warnings.push(`${parentLabel} cannot calculate cost per unit`);
		}

		const missingItemCount = this.count(rows, r =>
																				this.hasValue(r.item_type) &&
																				!this.hasItem(r)
																			 );

		const noCostCount = this.count(rows, r =>
																	 this.hasItem(r) &&
																	 r.active !== false &&
																	 (
			!this.hasValue(r.qty) ||
			(
				r.item_type !== "dish" &&
				!this.hasValue(r.unit_id)
			)
		)
																	);

		const inactiveCount = this.count(rows, r =>
																		 this.hasItem(r) &&
																		 r.active === false
																		);

		const deletedCount = this.count(rows, r =>
																		r.child_deleted === true ||
																		r.deleted === true ||
																		r.component_status === "Deleted"
																	 );

		if (missingItemCount > 0) {
			warnings.push(`${missingItemCount} ${this.plural(missingItemCount, "item is", "items are")} missing`);
		}

		if (noCostCount > 0) {
			warnings.push(`${noCostCount} ${this.plural(noCostCount, "item has", "items have")} no cost`);
		}

		if (inactiveCount > 0) {
			warnings.push(`${inactiveCount} ${this.plural(inactiveCount, "item is", "items are")} inactive`);
		}

		if (deletedCount > 0) {
			warnings.push(`${deletedCount} ${this.plural(deletedCount, "item is", "items are")} deleted`);
		}

		return warnings;
	}
}