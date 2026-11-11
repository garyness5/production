export default {
	mappings: [
		{
			match: "invalid login credentials",
			message: "There is an error in the email and/or password you entered. Please try again."
		},
		{
			match: "invalid email or password",
			message: "There is an error in the email and/or password you entered. Please try again."
		},
		{
			match: "email not confirmed",
			message: "Please confirm your email address before logging in."
		},
		{
			match: "too many requests",
			message: "Too many login attempts. Please wait a few minutes and try again."
		}
	],

	rawMessage(error) {
		const response = error?.response || {};
		const details = response?.error || {};
		const data = error?.data || {};
		const dataError = data?.error || {};

		return [
			details.error_code,
			details.code,
			details.msg,
			details.message,
			dataError.error_code,
			dataError.msg,
			error?.error_code,
			error?.code,
			error?.msg,
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

		// Login errors are different from expired sessions.
		if (
			/invalid_credentials|invalid login credentials|invalid email or password/i.test(raw)
		) {
			return "There is an error in the email and/or password you entered. Please try again.";
		}

		if (
			/email not confirmed/i.test(raw)
		) {
			return "Please confirm your email address before logging in.";
		}

		if (
			status === 429 ||
			/too many requests|rate limit/i.test(raw)
		) {
			return "Too many login attempts. Please wait a few minutes and try again.";
		}

		if (
			status === 401 ||
			/UNAUTHORIZED_ASYMMETRIC_JWT|invalid jwt|jwt expired|token expired|refresh token/i.test(raw)
		) {
			return "Your session has expired. Please log in again.";
		}

		if (status === 403) {
			return "You do not have permission to perform this action.";
		}

		if (
			/failed to fetch|network error|network request failed/i.test(raw)
		) {
			return "Connection failed. Please check your internet connection and try again.";
		}

		const found = (this.mappings || []).find(x =>
																						 raw.toLowerCase().includes(
			String(x.match || "").toLowerCase()
		)
																						);

		if (found) {
			return found.message;
		}

		// Never expose unrecognized technical errors to users.
		return fallback;
	},

	show(error, fallback = "The action could not be completed.") {
		showAlert(
			this.friendly(error, fallback),
			"error"
		);

		return false;
	}
};