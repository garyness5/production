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
	},

	dateTime(value) {

		if (!value) return "";

		const d = new Date(value);

		if (isNaN(d.getTime())) {
			return "";
		}

		const year =
					d.getFullYear();

		const month =
					new Intl.DateTimeFormat(
						undefined,
						{ month: "short" }
					).format(d);

		const day =
					String(
						d.getDate()
					).padStart(2, "0");

		const time =
					new Intl.DateTimeFormat(
						undefined,
						{
							hour: "numeric",
							minute: "2-digit"
						}
					).format(d);

		return `${year}-${month}-${day} | ${time}`;
	},
}