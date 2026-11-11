export default {

	async updateAll() {

		try {

			/*
         * Capture the current table Working State.
         */
			const staged =
					await this.stagePendingChanges();

			const changes =
					staged.changes;

			const hasParticipationRemovals =
					(changes.participationRemovals || []).length > 0;

			const hasFullRemovals =
					(changes.removals || []).length > 0;

			/*
         * Any destructive change requires one
         * combined confirmation before Supabase
         * is changed.
         */
			if (
				hasParticipationRemovals ||
				hasFullRemovals
			) {

				await storeValue(
					"gro_pending_update_reason",
					"batch_update"
				);

				showModal(
					mdlGroToOrderRemove.name
				);

				return false;
			}

			/*
         * Additions / ordinary refresh only:
         * no confirmation required.
         */
			return await this.runUpdateAll();

		} catch (error) {

			showAlert(
				error?.message ||
				"Groceries could not be updated.",
				"error"
			);

			return false;
		}
	},

	async runUpdateAll() {

		try {

			/*
         * Apply all staged To Order / Remove changes
         * and rebuild Details + Order once.
         *
         * Applicable manual Order values are
         * preserved by the backend.
         * Print is cleared by refresh_gro_order().
         */
			await qryGroApplyQueueChanges.run();


			/*
         * Revalidate upstream sources after applying
         * the user's Working State.
         */
			await qryGroCheckQSources.run();

			const queueImpact =
					qryGroCheckQSources.data?.[0] || {};

			const invalidSourceCount =
					Number(
						queueImpact.invalid_source_count || 0
					);

			if (invalidSourceCount > 0) {

				await qryGroRemoveInvalidQSource.run();

				/*
             * Invalid-source removal changed the queue,
             * so rebuild from the corrected final state.
             */
				await qryGroRefreshDetails.run();

				await storeValue(
					"gro_keep_manual",
					true
				);

				await qryGroRefreshOrder.run();
			}


			/*
         * Reload Saved State and clear table
         * Working State.
         */
			await qryGroGetQueue.run();

			await resetWidget(
				"tblGroEvents",
				true
			);


			/*
         * Clear temporary batch state.
         */
			await removeValue(
				"gro_pending_to_order_changes"
			);

			await removeValue(
				"gro_pending_remove_proposal_ids"
			);

			await removeValue(
				"gro_pending_update_reason"
			);

			await removeValue(
				"gro_keep_manual"
			);


			closeModal(
				mdlGroToOrderRemove.name
			);

			showAlert(
				"Groceries updated. Manual Order values were kept where applicable and Print was cleared.",
				"success"
			);

			return true;

		} catch (error) {

			showAlert(
				error?.message ||
				"Groceries could not be updated.",
				"error"
			);

			return false;
		}
	},

	async cancelUpdate() {

		/*
     * Nothing has reached Supabase yet.
     * Reload Saved State and discard the
     * checkbox Working State.
     */
		await qryGroGetQueue.run();

		await resetWidget(
			"tblGroEvents",
			true
		);

		await removeValue(
			"gro_pending_to_order_changes"
		);

		await removeValue(
			"gro_pending_remove_proposal_ids"
		);

		await removeValue(
			"gro_pending_update_reason"
		);

		closeModal(
			mdlGroToOrderRemove.name
		);

		return true;
	},

	filteredRows() {

		const rows =
				(qryGroGetQueue.data || []).map(row => ({
					...row,
					remove: false
				}));

		const filter =
				selGroFilter.selectedOptionValue || "All";

		const search =
				String(inpGroSearch.text || "")
			.trim()
			.toLowerCase();

		return rows.filter(row => {

			const matchesFilter =
					filter === "All"

			|| (
				filter === "To Order" &&
				row.to_order === true
			)

			|| (
				filter === "Waiting" &&
				row.to_order !== true
			);

			if (!matchesFilter) {
				return false;
			}

			if (!search) {
				return true;
			}

			const searchable =
					[
						row.event_name,
						row.event_ref,
						row.proposal_number
					]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();

			return searchable.includes(search);
		});
	},

	modalTitle() {
		return "Update Groceries?";
	},

	async confirmModal() {

		try {

			const reason =
					appsmith.store.gro_pending_update_reason;

			if (reason !== "batch_update") {

				showAlert(
					"No Groceries update is pending.",
					"warning"
				);

				return false;
			}

			return await this.runUpdateAll();

		} catch (error) {

			showAlert(
				error?.message ||
				"Groceries could not be updated.",
				"error"
			);

			return false;
		}
	},

	pendingChanges() {

		const savedRows =
				qryGroGetQueue.data || [];

		const updatedRows =
				tblGroEvents.updatedRows || [];

		const savedById =
				new Map(
					savedRows.map(row => [
						Number(row.gro_event_id),
						row
					])
				);

		const changes = {
			additions: [],
			participationRemovals: [],
			removals: []
		};

		updatedRows.forEach(update => {

			const working =
					update?.allFields || {};

			const id =
					Number(working.gro_event_id || 0);

			const saved =
					savedById.get(id);

			if (!id || !saved) {
				return;
			}

			/*
         * Remove overrides To Order.
         */
			if (working.remove === true) {

				changes.removals.push({
					...working
				});

				return;
			}

			const wasToOrder =
					saved.to_order === true;

			const isToOrder =
					working.to_order === true;

			if (!wasToOrder && isToOrder) {

				changes.additions.push({
					...working
				});

				return;
			}

			if (wasToOrder && !isToOrder) {

				changes.participationRemovals.push({
					...working
				});
			}
		});

		return changes;
	},

	pendingImpact() {

		const changes =
				this.pendingChanges();

		const participationRemovals =
				changes.participationRemovals || [];

		const removals =
				changes.removals || [];

		const affected =
				[
					...participationRemovals,
					...removals
				];

		return {
			additions:
			changes.additions || [],

			participationRemovals,

			removals,

			affected,

			hasDestructiveChanges:
			affected.length > 0
		};
	},

	async stagePendingChanges() {

		const changes =
				this.pendingChanges();

		const toOrderChanges = [
			...(changes.additions || []).map(row => ({
				proposal_id: Number(row.proposal_id),
				to_order: true
			})),

			...(changes.participationRemovals || []).map(row => ({
				proposal_id: Number(row.proposal_id),
				to_order: false
			}))
		];

		const removeProposalIds =
				(changes.removals || [])
			.map(row => Number(row.proposal_id))
			.filter(Boolean);

		await storeValue(
			"gro_pending_to_order_changes",
			toOrderChanges
		);

		await storeValue(
			"gro_pending_remove_proposal_ids",
			removeProposalIds
		);

		return {
			changes,
			toOrderChanges,
			removeProposalIds
		};
	},

	pendingEventsText() {

		const impact =
				this.pendingImpact();

		const staying =
				impact.participationRemovals || [];

		const removing =
				impact.removals || [];

		let text =
				"The selected changes will update Details and Order. " +
				"The Print page will be cleared.";

		text +=
			"\n\nEvents checked in the Remove column will also be removed " +
			"from the Groceries page. All other Events will remain in Groceries.";

		text +=
			"\n\nAffected Events";

		if (staying.length) {

			text +=
				"\n\n" +
				staying
				.map(row =>
						 "• " +
						 (row.event_name || row.event_ref || "Event")
						)
				.join("\n");
		}

		if (removing.length) {

			text +=
				"\n\nRemove checked\n" +
				removing
				.map(row =>
						 "• " +
						 (row.event_name || row.event_ref || "Event")
						)
				.join("\n");
		}

		text +=
			"\n\nManually entered Order values for remaining ingredients " +
			"will be kept where applicable.";

		text +=
			"\n\nDo you want to continue?";

		return text;
	}
};