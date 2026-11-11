export default {
	rows() {
		return jsPropComponents
			.effectiveRows()
			.filter(r =>
							r.menu_id ||
							r.guests != null ||
							r.extra_guests != null
						 );
	},

	list() {
		const warnings = [];

		const header = jsEvtWorkspace.current();

		if (header.active === false) {
			warnings.push(
				"Event is Inactive."
			);
		}

		if (!header.customer_id) {
			warnings.push(
				"No Customer selected."
			);
		}

		if (
			!(header.contact_ids || []).length
		) {
			warnings.push(
				"No Customer Contact selected."
			);
		}

		if (!header.venue_id) {
			warnings.push(
				"No Venue selected."
			);
		}

		if (
			header.venue_id &&
			!(header.venue_contact_ids || []).length
		) {
			warnings.push(
				"No Venue Contact selected."
			);
		}

		if (!header.event_datetime) {
			warnings.push(
				"Event Date/Time missing."
			);
		}

		if (
			header.total_guests_manual === null ||
			header.total_guests_manual === "" ||
			Number(header.total_guests_manual) <= 0
		) {
			warnings.push(
				"No. of Guests missing."
			);
		}

		this.rows().forEach(
			(r, i) => {
				const line =
							r.line_no ||
							i + 1;

				const name =
							r.menu_name ||
							"Menu";

				if (
					r.menu_id &&
					r.current_menu_deleted === true
				) {
					warnings.push(
						`Line ${line}: ${name} not found.`
					);

					return;
				}

				if (
					r.menu_id &&
					r.current_menu_active === false
				) {
					warnings.push(
						`Line ${line}: ${name} is inactive.`
					);
				}

				if (
					r.menu_id &&
					(
						r.guests === null ||
						r.guests === "" ||
						Number(r.guests) <= 0
					)
				) {
					warnings.push(
						`Line ${line}: guests missing.`
					);
				}

				if (
					r.menu_id &&
					r.current_menu_active !== false &&
					r.current_menu_deleted !== true &&
					(
						r.line_cost === null ||
						r.line_cost === ""
					)
				) {
					warnings.push(
						`Line ${line}: line cost missing.`
					);
				}
			}
		);

		return warnings;
	},

	text() {
		return this.list()
			.join(
			"<br>&nbsp;&nbsp;"
		);
	}
};