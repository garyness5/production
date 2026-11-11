export default {
	rows() {
		return jsDshCompTable.rowsForSave();
	},

	list() {
		return jsDshWarnEngine.buildWarnings({
			rows: this.rows(),
			parentLabel: "Dish",
			parentActive: chkDshActive.isChecked,
			parentYieldQty: inpDshServes.text,
			parentYieldUnit: "person"
		});
	},

	text() {
		const warnings = this.list();

		if (!warnings.length) return "";

		return "Your total cost may be wrong<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• " +
			warnings.join("<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• ");
	}
};