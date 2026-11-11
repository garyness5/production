export default {
	async save(saveAndNew = false, bypassDuplicate = false) {
		const contactName =
			(inpVenueContactName.text || "").trim();

		if (!contactName) {
			showAlert(
				"Contact Name is required.",
				"warning"
			);
			return;
		}

		try {
			if (!bypassDuplicate) {
				const duplicate =
					await qryVnuCheckContactDuplicate.run();

				if (duplicate?.length) {
					await storeValue(
						"venue_contact_duplicate_name",
						contactName
					);

					await storeValue(
						"venue_contact_duplicate_save_and_new",
						saveAndNew
					);

					showModal(
						"mdlVenueContactDupeWarning"
					);

					return;
				}
			}

			const existingIds = [
				...(msVenueContacts.selectedOptionValues || [])
			].map(String);

			const result =
				await qryVnuSaveContactMaster.run();

			const savedRow =
				Array.isArray(result)
					? result[0]
					: Array.isArray(
							qryVnuSaveContactMaster.data
						)
						? qryVnuSaveContactMaster.data[0]
						: result;

			const contactId = Number(
				savedRow?.contact_id ??
					savedRow?.id ??
					0
			);

			if (!contactId) {
				throw new Error(
					"Contact saved, but its ID was not returned."
				);
			}

			await qryVnuGetContacts.run();

			const selectedIds = [
				...new Set([
					...existingIds,
					String(contactId)
				])
			];

			await storeValue(
				"venue_contact_ids",
				selectedIds
			);

			await resetWidget(
				"msVenueContacts",
				true
			);

			await jsVnuSaveContact.resetQuickFields();

			await removeValue(
				"venue_contact_duplicate_name"
			);

			await removeValue(
				"venue_contact_duplicate_save_and_new"
			);

			showAlert(
				"Contact saved.",
				"success"
			);

			if (saveAndNew === false) {
				await storeValue(
					"venueAccordion",
					""
				);
			}
		} catch (error) {
			showAlert(
				error?.message ||
					"Contact could not be saved.",
				"error"
			);
		}
	},

	async resetQuickFields() {
		await resetWidget(
			"inpVenueContactName",
			true
		);

		await resetWidget(
			"inpVenueContactTitle",
			true
		);

		await resetWidget(
			"inpVenueContactPhone",
			true
		);

		await resetWidget(
			"inpVenueContactMobile",
			true
		);

		await resetWidget(
			"inpVenueContactEmail",
			true
		);

		await resetWidget(
			"inpVenueContactNotes",
			true
		);
	},

	async toggleAddAccordion() {
		if (
			appsmith.store.venueAccordion ===
			"addContact"
		) {
			await jsVnuSaveContact.resetQuickFields();

			await storeValue(
				"venueAccordion",
				""
			);

			return;
		}

		await jsVnuSaveContact.resetQuickFields();

		await storeValue(
			"venueAccordion",
			"addContact"
		);
	},

	getContactOptions() {
		const selectedIds = new Set(
			(
				appsmith.store.venue_contact_ids ||
				[]
			).map(String)
		);

		return [...(qryVnuGetContacts.data || [])]
			.sort((a, b) => {
				const aSelected =
					selectedIds.has(String(a.id));

				const bSelected =
					selectedIds.has(String(b.id));

				if (aSelected !== bSelected) {
					return aSelected ? -1 : 1;
				}

				return String(
					a.contact_name || ""
				).localeCompare(
					String(
						b.contact_name || ""
					),
					undefined,
					{
						sensitivity: "base"
					}
				);
			})
			.map(contact => ({
				label:
					contact.display_name ||
					contact.contact_name,
				value: String(contact.id)
			}));
	},

	async confirmDuplicate() {
		closeModal(
			"mdlVenueContactDupeWarning"
		);

		await jsVnuSaveContact.save(
			appsmith.store
				.venue_contact_duplicate_save_and_new === true,
			true
		);
	},

	async cancelDuplicate() {
		closeModal(
			"mdlVenueContactDupeWarning"
		);

		await removeValue(
			"venue_contact_duplicate_name"
		);

		await removeValue(
			"venue_contact_duplicate_save_and_new"
		);
	}
};