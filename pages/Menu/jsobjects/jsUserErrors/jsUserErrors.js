export default {
	mappings: [],

	rawMessage(error) {
		return String(
			error?.message ||
			error ||
			""
		).trim();
	},

	friendly(error, fallback = "The action could not be completed.") {
		const raw =
					this.rawMessage(error);

		if (!raw) {
			return fallback;
		}

		const found =
					this.mappings.find(x =>
														 raw.toLowerCase().includes(
						x.match.toLowerCase()
					)
														);

		if (found) {
			return found.message;
		}

		return (
			this.cleanTechnicalDetails(raw) ||
			fallback
		);
	},

	cleanTechnicalDetails(raw) {
		let text =
				String(raw || "").trim();

		/*
			Keep the useful database message,
			remove Postgres / PLpgSQL implementation noise.
		*/
		text =
			text
			.replace(
			/\s+Where:\s+PL\/pgSQL[\s\S]*$/i,
			""
		)
			.replace(
			/\s+CONTEXT:\s+PL\/pgSQL[\s\S]*$/i,
			""
		)
			.replace(
			/^ERROR:\s*/i,
			""
		)
			.trim();

		return text;
	},

	show(error, fallback = "The action could not be completed.") {
		showAlert(
			this.friendly(
				error,
				fallback
			),
			"error"
		);

		return false;
	}
};