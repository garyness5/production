export default {
	mappings: [],

	rawMessage(error) {
		const response = error?.response || {};
		const details = response?.error || {};

		return [
			details.code,
			details.message,
			error?.code,
			error?.message,
			typeof error === "string" ? error : ""
		]
			.filter(Boolean)
			.join(" ")
			.trim();
	},

	friendly(error, fallback = "The action could not be completed.") {
		const raw = this.rawMessage(error);

		const status = Number(
			error?.statusCode ||
			error?.status ||
			error?.response?.statusCode ||
			error?.response?.status ||
			0
		);

		if (
			status === 401 ||
			/UNAUTHORIZED_ASYMMETRIC_JWT|invalid jwt|jwt expired|token expired|refresh token/i.test(raw)
		) {
			return "Your session has expired. Please log in again.";
		}

		if (status === 403) {
			return "You do not have permission to perform this action.";
		}

		if (/failed to fetch|network error|network request failed/i.test(raw)) {
			return "Connection failed. Please check your internet connection and try again.";
		}

		if (!raw) {
			return fallback;
		}

		const found = (this.mappings || []).find(x =>
																						 raw.toLowerCase().includes(
			String(x.match || "").toLowerCase()
		)
																						);

		if (found) {
			return found.message;
		}

		return this.cleanTechnicalDetails(raw) || fallback;
	},

	cleanTechnicalDetails(raw) {
		return String(raw || "")
			.trim()
			.replace(/\s+Where:\s+PL\/pgSQL[\s\S]*$/i, "")
			.replace(/\s+CONTEXT:\s+PL\/pgSQL[\s\S]*$/i, "")
			.replace(/^ERROR:\s*/i, "")
			.trim();
	},

	show(error, fallback = "The action could not be completed.") {
		showAlert(
			this.friendly(error, fallback),
			"error"
		);

		return false;
	}
};