export default {
	rows() {
		return jsRecCompTable.mergeUpdatedRows();
	},

	list() {
		return jsWarnEngine.buildWarnings({
			rows: this.rows(),
			parentLabel: "Recipe",
			parentActive: chkRecActive.isChecked,
			parentYieldQty: inpRecYieldQty.text,
			parentYieldUnit: selRecYieldUnit.selectedOptionValue
		});
	},

	text() {
		const warnings = this.list();

		if (!warnings.length) return "";

		return "Your total cost may be wrong<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• " +
			warnings.join("<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• ");
	}
}