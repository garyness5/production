export default {
	async save(closeAfter) {
		const venueName =
					(inpVenueName.text || "").trim();

		if (!venueName) {
			showAlert(
				"Venue Name is required.",
				"warning"
			);
			return;
		}

		try {
			const duplicate =
						await qryVnuCheckVenueDuplicate.run();

			if (duplicate?.length) {
				await storeValue(
					"venue_duplicate_name",
					venueName
				);

				showModal(
					mdlVenueDuplicateWarning.name
				);

				return;
			}

			const result =
						await qryVnuSaveMaster.run();

			const savedRow =
						Array.isArray(result)
			? result[0]
			: Array.isArray(
				qryVnuSaveMaster.data
			)
			? qryVnuSaveMaster.data[0]
			: result;

			const savedVenueId = Number(
				savedRow?.venue_id ??
				savedRow?.id ??
				0
			);

			if (!savedVenueId) {
				throw new Error(
					"Venue was not saved."
				);
			}

			await storeValue(
				"current_venue_id",
				savedVenueId
			);

			await storeValue(
				"original_venue_name",
				venueName
			);

			await removeValue(
				"venue_duplicate_name"
			);

			await qryVnuGetVenues.run();

			showAlert(
				"Venue saved.",
				"success"
			);

			if (closeAfter === false) {
				await jsVnuSaveVenue.prepareNew();
			} else {
				closeModal(mdlVenue.name);
			}
		} catch (error) {
			showAlert(
				error?.message ||
				"Venue could not be saved.",
				"error"
			);
		}
	},

	async prepareNew() {
		await storeValue(
			"venue_form_mode",
			"add"
		);

		await storeValue(
			"current_venue_id",
			0
		);

		await storeValue(
			"venue_contact_ids",
			[]
		);

		await storeValue(
			"venueAccordion",
			""
		);

		await removeValue(
			"original_venue_name"
		);

		await removeValue(
			"venue_duplicate_name"
		);

		await jsVnuSaveContact.resetQuickFields();

		await resetWidget(
			"mdlVenue",
			true
		);

		await resetWidget(
			"msVenueContacts",
			true
		);
	},

	async openNew() {
		await jsVnuSaveVenue.prepareNew();

		showModal(
			mdlVenue.name
		);
	},

	async openEdit() {
		const selectedVenue =
					tblVenues.selectedRow;

		const venueId = Number(
			selectedVenue?.id || 0
		);

		if (!venueId) {
			showAlert(
				"Select a Venue first.",
				"warning"
			);
			return;
		}

		await storeValue(
			"current_venue_id",
			venueId
		);

		await storeValue(
			"venue_form_mode",
			"edit"
		);

		await storeValue(
			"original_venue_name",
			selectedVenue.venue_name || ""
		);

		await storeValue(
			"venueAccordion",
			""
		);

		await removeValue(
			"venue_duplicate_name"
		);

		await jsVnuSaveContact.resetQuickFields();

		await qryVnuGetContactLinks.run();

		await storeValue(
			"venue_contact_ids",
			(qryVnuGetContactLinks.data || [])
			.map(
				row =>
				String(row.contact_id)
			)
		);

		await resetWidget(
			"mdlVenue",
			true
		);

		await resetWidget(
			"msVenueContacts",
			true
		);

		showModal(
			mdlVenue.name
		);
	},

	async duplicate() {
		const sourceId = Number(
			tblVenues.selectedRow?.id || 0
		);

		if (!sourceId) {
			showAlert(
				"Select a Venue to duplicate.",
				"warning"
			);
			return;
		}

		try {
			const result =
						await qryVnuDuplicateMaster.run();

			const duplicatedVenueId = Number(
				result?.[0]?.venue_id || 0
			);

			if (!duplicatedVenueId) {
				throw new Error(
					"The duplicated Venue ID was not returned."
				);
			}

			await storeValue(
				"current_venue_id",
				duplicatedVenueId
			);

			await storeValue(
				"venue_form_mode",
				"edit"
			);

			await storeValue(
				"venueAccordion",
				""
			);

			await qryVnuGetVenues.run();

			const duplicatedRow =
						(qryVnuGetVenues.data || []).find(
							row =>
							Number(row.id) === duplicatedVenueId
						);

			await storeValue(
				"original_venue_name",
				duplicatedRow?.venue_name || ""
			);

			await qryVnuGetContactLinks.run();

			await storeValue(
				"venue_contact_ids",
				(qryVnuGetContactLinks.data || []).map(
					row => String(row.contact_id)
				)
			);

			await resetWidget(
				"mdlVenue",
				true
			);

			await resetWidget(
				"msVenueContacts",
				true
			);

			showModal(mdlVenue.name);

			showAlert(
				"Venue duplicated.",
				"success"
			);
		} catch (error) {
			showAlert(
				error?.message ||
				"Venue could not be duplicated.",
				"error"
			);
		}
	},

	async close() {
		await storeValue(
			"venueAccordion",
			""
		);

		await jsVnuSaveContact.resetQuickFields();

		closeModal(
			mdlVenue.name
		);
	},

	async closeDuplicateWarning() {
		closeModal(mdlVenueDuplicateWarning.name);

		await removeValue("venue_duplicate_name");

		showModal(mdlVenue.name);
	},

	async openDelete() {
		const venueId = Number(tblVenues.selectedRow?.id || 0);

		if (!venueId) {
			showAlert("Select a Venue to delete.", "warning");
			return;
		}

		try {
			await qryVnuGetDeleteImpact.run();

			showModal(mdlVenueDelConfirm.name);
		} catch (error) {
			showAlert(
				error?.message ||
				"Venue impact could not be checked.",
				"error"
			);
		}
	},

	async deleteVenue() {
		const venueId = Number(
			appsmith.store.current_venue_id ||
			tblVenues.selectedRow?.id ||
			0
		);

		if (!venueId) {
			showAlert("No Venue is selected.", "warning");
			return;
		}

		try {
			const result = await qryVnuDeleteMaster.run();

			if (!result?.length) {
				throw new Error("The Venue was not deleted.");
			}

			closeModal(mdlVenueDelConfirm.name);

			await removeValue("current_venue_id");
			await removeValue("current_venue_record");
			await removeValue("venue_contact_ids");

			await qryVnuGetVenues.run();

			showAlert("Venue deleted.", "success");
		} catch (error) {
			showAlert(
				error?.message || "Venue could not be deleted.",
				"error"
			);
		}
	},

		async cancelDelete() {
			closeModal(mdlVenueDelConfirm.name);
			await removeValue("current_venue_id");
		},

			async setActive(venueId, active) {
				const id = Number(venueId || 0);

				if (!id) {
					showAlert(
						"Venue ID is missing.",
						"error"
					);

					await qryVnuGetVenues.run();
					return;
				}

				try {
					await qryVnuToggleActive.run({
						venue_id: id,
						active: active === true
					});

					await qryVnuGetVenues.run();
				} catch (error) {
					showAlert(
						error?.message ||
						"Venue status could not be updated.",
						"error"
					);

					await qryVnuGetVenues.run();
				}
			},

				venueSnapshotFromPage() {
					return {
						name: (inpVenueName.text || "").trim(),
						address: (inpVenueAddress.text || "").trim(),
						phone: (inpVenuePhone.text || "").trim(),
						mobile: (inpVenueMobile.text || "").trim(),
						email: (inpVenueEmail.text || "").trim(),
						notes: (inpVenueNotes.text || "").trim(),
						active: chkVenueActive.isChecked !== false,

						contact_ids: (msVenueContacts.selectedOptionValues || [])
						.map(Number)
						.filter(Boolean)
						.sort((a, b) => a - b)
					};
				},

					venueSnapshotFromSaved() {
						const venueId =
									Number(appsmith.store.current_venue_id || 0);

						const saved =
									(qryVnuGetVenues.data || []).find(
										row => Number(row.id) === venueId
									) || {};

						return {
							name: (saved.venue_name || "").trim(),
							address: (saved.address || "").trim(),
							phone: (saved.phone || "").trim(),
							mobile: (saved.mobile || "").trim(),
							email: (saved.email || "").trim(),
							notes: (saved.generic_notes || "").trim(),
							active: saved.active !== false,

							contact_ids: (appsmith.store.venue_contact_ids || [])
							.map(Number)
							.filter(Boolean)
							.sort((a, b) => a - b)
						};
					},

						isDirty() {
							const page = this.venueSnapshotFromPage();
							const saved = this.venueSnapshotFromSaved();

							return JSON.stringify(page) !== JSON.stringify(saved);
						},
};