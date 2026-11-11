export default {
	rows() {
		return jsMnuCompTable.rowsForSave();
	},

	list() {
		return jsMnuWarnEngine.buildWarnings({
			rows: this.rows(),
			parentLabel: "Menu",
			parentActive: chkMnuActive.isChecked,
			parentYieldQty: inpMnuServes.text,
			parentYieldUnit: "person"
		});
	},

	text() {
		const warnings = this.list();

		if (!warnings.length) return "";

		return "Your total cost may be wrong<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• " +
			warnings.join(
			"<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• "
		);
	}
};