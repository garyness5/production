export default {
	mappings: [
		{
			match: "RECIPE_CIRCULAR_REFERENCE",
			message:
			"This Recipe is already used in one of the selected sub-recipes. " +
			"Saving it would create a loop where Recipes contain each other. " +
			"Please remove the conflicting sub-recipe and try again."
		},
		{
			match: "action execution timed out",
			message:
			"Savveyra could not confirm whether the action was completed. " +
			"This may be caused by an interrupted internet connection " +
			"or a temporary server problem. " +
			"Please check your connection before trying again."
		},
		{
			match: "network request failed",
			message:
			"Unable to connect to Savveyra. " +
			"Please check your internet connection and try again."
		},
		{
			match: "failed to fetch",
			message:
			"Unable to connect to Savveyra. " +
			"Please check your internet connection and try again."
		},
		{
			match: "networkerror",
			message:
			"A connection problem occurred. " +
			"Please check your internet connection and try again."
		},
		{
			match: "jwt expired",
			message:
			"Your session has expired. " +
			"Please sign in again."
		},
		{
			match: "invalid jwt",
			message:
			"Your session is no longer valid. " +
			"Please sign in again."
		}
	],

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
	},

	loginMessage(error) {
		const raw = String(
			error?.message ||
			error?.error ||
			error ||
			""
		).toLowerCase();

		if (
			raw.includes("invalid login credentials") ||
			raw.includes("invalid credentials") ||
			raw.includes("invalid email or password")
		) {
			return "Unable to sign in. Please check your email and password, then try again.";
		}

		if (raw.includes("email not confirmed")) {
			return "Please confirm your email address before signing in.";
		}

		if (raw.includes("too many requests") || raw.includes("rate limit")) {
			return "Too many sign-in attempts. Please wait a few minutes and try again.";
		}

		return "Unable to connect to the sign-in service. Please try again shortly.";
	},
};