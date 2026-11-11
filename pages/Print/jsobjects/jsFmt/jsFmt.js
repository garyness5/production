export default {
	currency(value) {
		if (value === null || value === undefined || value === "") return "";

		const n = Number(value);

		if (!isFinite(n)) return "";

		return n.toLocaleString(undefined, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
	},

	number(value) {
		if (value === null || value === undefined || value === "") return "";

		const n = Number(value);

		if (!isFinite(n)) return "";

		return n.toLocaleString(undefined, {
			minimumFractionDigits: Number.isInteger(n) ? 0 : 0,
			maximumFractionDigits: 2
		});
	}
}