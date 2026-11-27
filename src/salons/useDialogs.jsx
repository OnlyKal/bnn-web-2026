import React, { useCallback, useRef, useState } from 'react';
import { Modal } from './SalonUi';

/**
 * Remplace window.confirm / window.prompt par de vraies fenêtres modales.
 *   const { confirm, prompt, dialog } = useDialogs();
 *   if (!await confirm({ title, message, confirmLabel, danger })) return;
 *   const texte = await prompt({ title, label, placeholder });   // null si annulé
 * `dialog` est l'élément à placer une fois dans la page.
 */
const useDialogs = () => {
    const [state, setState] = useState(null);
    const [value, setValue] = useState('');
    const resolverRef = useRef(null);

    const close = useCallback((result) => {
        resolverRef.current?.(result);
        resolverRef.current = null;
        setState(null);
    }, []);

    const confirm = useCallback((options) => new Promise((resolve) => {
        resolverRef.current = resolve;
        setState({ kind: 'confirm', ...options });
    }), []);

    const prompt = useCallback((options) => new Promise((resolve) => {
        resolverRef.current = resolve;
        setValue(options.initial || '');
        setState({ kind: 'prompt', ...options });
    }), []);

    const cancel = useCallback(() => close(state?.kind === 'prompt' ? null : false), [close, state]);
    const submit = (event) => {
        event?.preventDefault();
        if (state?.kind === 'prompt') {
            if (state.required && !value.trim()) return;
            close(value);
        } else {
            close(true);
        }
    };

    const dialog = (
        <Modal
            open={!!state}
            title={state?.title || ''}
            onClose={cancel}
            labelledBy="salon-ask-title"
            footer={(
                <>
                    <button type="button" className="salons-secondary-btn" onClick={cancel}>{state?.cancelLabel || 'Annuler'}</button>
                    <button
                        type="button"
                        className={`${state?.danger ? 'salons-danger-btn' : 'salons-primary-btn'} salon-dialog-confirm`}
                        onClick={submit}
                        autoFocus={state?.kind === 'confirm'}
                    >
                        {state?.confirmLabel || 'Valider'}
                    </button>
                </>
            )}
        >
            {state?.message && (typeof state.message === 'string' ? <p>{state.message}</p> : state.message)}
            {state?.kind === 'prompt' && (
                <form onSubmit={submit}>
                    {state.label && <label className="salon-dialog-label" htmlFor="salon-ask-input">{state.label}</label>}
                    {state.multiline ? (
                        <textarea id="salon-ask-input" className="salon-dialog-input" rows="3" value={value} onChange={(e) => setValue(e.target.value)} placeholder={state.placeholder} autoFocus />
                    ) : (
                        <input id="salon-ask-input" className="salon-dialog-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder={state.placeholder} autoFocus />
                    )}
                </form>
            )}
        </Modal>
    );

    return { confirm, prompt, dialog };
};

export default useDialogs;
