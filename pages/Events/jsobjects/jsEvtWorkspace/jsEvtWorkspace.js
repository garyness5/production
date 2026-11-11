export default {
	emptyWorkspace() {
		return {
			event_id: 0,

			name: null,
			event_ref: null,
			event_datetime: null,

			customer_id: null,
			contact_ids: [],

			venue_id: null,
			venue_contact_ids: [],

			total_guests_manual: null,
			format: null,

			customer_notes: null,
			internal_notes: null,

			active: true,

			closed: false,
			status: "Draft",
			closed_at: null,
			closed_proposal_id: null
		};
	},

	textClean(value) {
		const text =
					String(value || "").trim();

		return text || null;
	},

	numberOrNull(value) {
		if (
			value === "" ||
			value === null ||
			value === undefined
		) {
			return null;
		}

		const number =
					Number(value);

		return Number.isFinite(number)
			? number
		: null;
	},

	normalizeIds(values) {
		return (values || [])
			.map(Number)
			.filter(Boolean);
	},

	savedEventDateTime(row) {
		if (!row) {
			return null;
		}

		if (
			row.event_date &&
			row.event_time
		) {
			const date =
						String(row.event_date)
			.substring(0, 10);

			const time =
						String(row.event_time)
			.substring(0, 8);

			return `${date} ${time}`;
		}

		if (row.event_datetime) {
			/*
		 * Fallback only.
		 *
		 * Database value is a wall-clock
		 * timestamp, so preserve its clock
		 * digits without timezone conversion.
		 */
			return moment
				.utc(row.event_datetime)
				.format(
				"YYYY-MM-DD HH:mm:ss"
			);
		}

		return null;
	},

	normalizeWorkspace(data = {}) {
		return {
			event_id:
			Number(
				data.event_id || 0
			),

			name:
			this.textClean(
				data.name
			),

			event_ref:
			this.textClean(
				data.event_ref
			),

			event_datetime:
			data.event_datetime
			? moment(
				data.event_datetime
			).format(
				"YYYY-MM-DD HH:mm:ss"
			)
			: null,

			customer_id:
			this.numberOrNull(
				data.customer_id
			),

			contact_ids:
			this.normalizeIds(
				data.contact_ids
			),

			venue_id:
			this.numberOrNull(
				data.venue_id
			),

			venue_contact_ids:
			this.normalizeIds(
				data.venue_contact_ids
			),

			format:
			this.textClean(
				data.format
			),

			total_guests_manual:
			this.numberOrNull(
				data.total_guests_manual
			),

			customer_notes:
			this.textClean(
				data.customer_notes
			),

			internal_notes:
			this.textClean(
				data.internal_notes
			),

			active:
			data.active === false
			? false
			: true,

			closed:
			Object.prototype.hasOwnProperty.call(
				data,
				"closed"
			)
			? data.closed === true
			: String(
				data.status || ""
			).trim() === "Closed",

			status:
			String(
				data.status || "Draft"
			).trim() || "Draft",

			closed_at:
			data.closed_at || null,

			closed_proposal_id:
			Number(
				data.closed_proposal_id || 0
			) || null
		};
	},

	savedEvent() {
		const currentEventId =
					Number(
						appsmith.store.current_event_id || 0
					);

		/*
	 * Unsaved Event / Duplicate:
	 * there is no persisted Event baseline.
	 */
		if (currentEventId <= 0) {
			return this.emptyWorkspace();
		}

		const row =
					Array.isArray(
						qryEvtGetItemById.data
					)
		? qryEvtGetItemById.data[0]
		: qryEvtGetItemById.data;

		/*
	 * Never allow stale query data from another
	 * Event identity to become saved truth.
	 */
		if (
			!row ||
			Number(row.id || 0) !== currentEventId
		) {
			return this.emptyWorkspace();
		}

		return this.normalizeWorkspace({
			event_id:
			Number(row.id || 0),

			name:
			row.name,

			event_ref:
			row.event_ref,

			event_datetime:
			this.savedEventDateTime(row),

			customer_id:
			row.customer_id,

			contact_ids:
			row.contact_ids || [],

			venue_id:
			row.venue_id,

			venue_contact_ids:
			row.venue_contact_ids || [],

			format:
			row.format,

			total_guests_manual:
			row.total_guests_manual,

			customer_notes:
			row.customer_notes,

			internal_notes:
			row.notes,

			active:
			row.active,

			closed:
			row.status === "Closed",

			status:
			row.status || "Draft",

			closed_at:
			row.closed_at || null,

			closed_proposal_id:
			Number(
				row.closed_proposal_id || 0
			) || null
		});
	},

	/*
 * Stored Event Working State.
 *
 * This is the last captured complete
 * Header state, not necessarily every
 * character currently being typed.
 */
	get() {
		const workspace =
					appsmith.store.event_workspace;

		if (
			workspace &&
			Number(
				workspace.event_id || 0
			) ===
			Number(
				appsmith.store.current_event_id || 0
			)
		) {
			return this.normalizeWorkspace(
				workspace
			);
		}

		return this.savedEvent();
	},

	/*
 * Current visible Header Working State.
 *
 * Text widgets are read directly here
 * instead of writing to appsmith.store
 * on every keystroke.
 *
 * Therefore rapid typing cannot race
 * against a workspace rerender.
 */
	current() {
		const base =
					this.get();

		return this.normalizeWorkspace({
			...base,

			event_ref:
			inpEvtRef.text,

			event_datetime:
			datEvtDate.selectedDate === "" ||
			datEvtDate.selectedDate === null
			? null
			: (
				datEvtDate.selectedDate ??
				base.event_datetime
			),

			customer_id:
			selEvtCustomer
			.selectedOptionValue,

			contact_ids:
			msEvtContacts
			.selectedOptionValues ||
			[],

			venue_id:
			selEvtVenue
			.selectedOptionValue,

			venue_contact_ids:
			msEvtVenueContacts
			.selectedOptionValues ||
			[],

			format:
			selEvtFormat
			.selectedOptionValue,

			total_guests_manual:
			inpTotalGuests.text === "" || inpTotalGuests.text == null
			? null
			: Number(inpTotalGuests.text),

			customer_notes:
			rteEvtCustomerNotes.text,

			internal_notes:
			rteEvtInternalNotes.text,

			active:
			chkEvtActive.isChecked
		});
	},

	async initialize() {
		const saved =
					this.savedEvent();

		await storeValue(
			"event_workspace",
			saved
		);

		return saved;
	},

	async clear() {
		await removeValue(
			"event_workspace"
		);

		return true;
	},

	async resetFromSaved() {
		await this.clear();

		return await this.initialize();
	},

	async set(workspace) {
		const normalized =
					this.normalizeWorkspace({
						...workspace,

						event_id:
						Number(
							appsmith.store
							.current_event_id ||
							0
						)
					});

		await storeValue(
			"event_workspace",
			normalized
		);

		return normalized;
	},

	/*
	 * Capture EVERYTHING currently visible
	 * before applying a field-specific change.
	 *
	 * This is the key rule:
	 * changing one Header field can never
	 * overwrite unsaved work in another.
	 */
	async capture(patch = {}) {
		return await this.set({
			...this.current(),
			...patch
		});
	},

	async setCustomer(value) {
		const customerId =
					this.numberOrNull(value);

		await this.capture({
			customer_id: customerId,
			contact_ids: []
		});

		await qryEvtGetContacts.run();

		const singleContactId =
					this.singleLinkedContactId(
						qryEvtGetContacts.data || []
					);

		if (singleContactId) {
			await this.capture({
				contact_ids: [
					singleContactId
				]
			});
		}

		await resetWidget(
			"msEvtContacts",
			true
		);

		return this.get();
	},
	async setCustomerContacts(values) {
		return await this.capture({
			contact_ids:
			this.normalizeIds(
				values
			)
		});
	},

	async setVenue(value) {
		const venueId =
					this.numberOrNull(value);

		await this.capture({
			venue_id:
			venueId,

			venue_contact_ids: []
		});

		await qryEvtGetVenueContacts.run();

		const singleContactId =
					this.singleLinkedContactId(
						qryEvtGetVenueContacts.data || []
					);

		if (singleContactId) {
			await this.capture({
				venue_contact_ids: [
					singleContactId
				]
			});
		}

		await resetWidget(
			"msEvtVenueContacts",
			true
		);

		return this.get();
	},

	async setVenueContacts(values) {
		return await this.capture({
			venue_contact_ids:
			this.normalizeIds(
				values
			)
		});
	},

	linkedContactIds(rows = []) {
		return (rows || [])
			.filter(row =>
							row.linked_to_selected_customer === true ||
							row.linked_to_selected_customer === "true" ||
							row.linked_to_selected_venue === true ||
							row.linked_to_selected_venue === "true"
						 )
			.map(row =>
					 Number(
			row.value ??
			row.id ??
			0
		)
					)
			.filter(Boolean);
	},

	singleLinkedContactId(rows = []) {
		const ids =
					this.linkedContactIds(rows);

		return ids.length === 1
			? ids[0]
		: null;
	},

	async setFormat(value) {
		return await this.capture({
			format: value
		});
	},

	async setActive(value) {
		return await this.capture({
			active:
			value === false
			? false
			: true
		});
	},

	async setClosed(value) {
		return await this.capture({
			closed:
			value === true
		});
	},

	displayStatus() {
		const workspace =
					this.current();

		if (workspace.closed) {
			return "Closed";
		}

		return (
			String(
				workspace.status || "Draft"
			).trim() ||
			"Draft"
		);
	},

	closeCostSource() {
		const rows =
					qryEvtGetPropsForEvent.data || [];

		const ordered =
					rows.find(row =>
										row.proposal_status === "Ordered"
									 );

		if (ordered) {
			return {
				id:
				Number(ordered.id || 0),

				status:
				"Ordered",

				label:
				String(
					ordered.proposal_number ||
					ordered.proposal_title ||
					`Proposal ${ordered.proposal_no || ""}`
				).trim()
			};
		}

		const accepted =
					rows.find(row =>
										row.proposal_status === "Accepted"
									 );

		if (accepted) {
			return {
				id:
				Number(accepted.id || 0),

				status:
				"Accepted",

				label:
				String(
					accepted.proposal_number ||
					accepted.proposal_title ||
					`Proposal ${accepted.proposal_no || ""}`
				).trim()
			};
		}

		return null;
	},

	closeMessage() {
		const source =
					this.closeCostSource();

		const freezeWarning = [
			"Closing this Event permanently freezes its Menu costs.",
			"Future changes to Ingredient, Recipe, Dish or Menu costs will not update this Event, even if the Event is later reopened.",
			"Use Duplicate if you need a new Event using current costs."
		];

		if (!source) {
			return [
				...freezeWarning,
				"",
				"No Proposal is currently marked Ordered or Accepted. The Event can still be closed, but no frozen Event cost will be recorded.",
				"",
				"To view closed Events later, select Closed from the Filter dropdown at the top of EventList."
			].join("\n");
		}

		return [
			...freezeWarning,
			"",
			`Frozen cost source: ${source.label} — ${source.status}`,
			"",
			"Please confirm this is the correct Proposal before closing."
		].join("\n");
	},

	async confirmClose() {
		closeModal(
			mdlEvtClose.name
		);

		await this.setClosed(true);

		await resetWidget(
			"chkEvtClosed",
			true
		);

		return true;
	},

	async cancelClose() {
		closeModal(
			mdlEvtClose.name
		);

		await this.setClosed(false);

		await resetWidget(
			"chkEvtClosed",
			true
		);

		return true;
	},

	canShowClosed() {
		return (
			Number(
				appsmith.store.current_event_id || 0
			) > 0
		);
	},

	isClosedLocked() {
		return (
			this.savedEvent().closed === true &&
			this.current().closed === true
		);
	},

	async requestClosedChange(value) {
		const wantsClosed =
					value === true;

		const savedClosed =
					this.savedEvent().closed === true;

		/*
	 * User is asking to Close an open Event.
	 *
	 * Do not change Working State yet.
	 * Restore the checkbox and show confirmation.
	 */
		if (wantsClosed) {
			await this.setClosed(false);

			await resetWidget(
				"chkEvtClosed",
				true
			);

			showModal(
				mdlEvtClose.name
			);

			return false;
		}

		/*
	 * Normal open Event.
	 */
		if (!savedClosed) {
			return await this.setClosed(false);
		}

		/*
	 * Saved Closed Event:
	 * restore Closed while asking whether to
	 * Reopen, Duplicate or Cancel.
	 */
		await this.setClosed(true);

		await resetWidget(
			"chkEvtClosed",
			true
		);

		showModal(
			mdlEvtReopen.name
		);

		return false;
	},

	async confirmReopen() {
		closeModal(
			mdlEvtReopen.name
		);

		await this.setClosed(false);

		await resetWidget(
			"chkEvtClosed",
			true
		);

		return true;
	},

	async cancelReopen() {
		closeModal(
			mdlEvtReopen.name
		);

		await this.setClosed(true);

		await resetWidget(
			"chkEvtClosed",
			true
		);

		return true;
	},

	async duplicateFromReopen() {
		closeModal(
			mdlEvtReopen.name
		);

		await this.setClosed(true);

		await resetWidget(
			"chkEvtClosed",
			true
		);

		return await jsEvtActionGuard.request(
			"duplicate"
		);
	},
};