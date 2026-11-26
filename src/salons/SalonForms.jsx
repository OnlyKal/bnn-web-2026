import React, { useState } from 'react';
import { FaGlobeAfrica, FaLock, FaPaperclip } from 'react-icons/fa';
import { ACCEPTED_FILES, MAX_RESOURCES, getResourceCount, toLocalInputValue, validateResources } from './salonUtils';

const emptyResources = { fichiers: [], liens: '' };

export const UploadField = ({ id, files, onChange, label = 'Joindre fichier(s)' }) => (
    <label className="salon-upload-field" htmlFor={id}>
        <span className="salon-upload-icon"><FaPaperclip /></span>
        <span className="salon-upload-copy">
            <span className="salon-upload-title">{label}</span>
            {!!files?.length && (
                <span className="salon-upload-hint">
                    {files.length === 1 ? files[0].name : `${files.length} fichiers sélectionnés`}
                </span>
            )}
        </span>
        <input
            id={id}
            type="file"
            accept={ACCEPTED_FILES}
            multiple
            onChange={(event) => onChange(Array.from(event.target.files || []))}
        />
    </label>
);

const ResourceFields = ({ idPrefix, form, setForm, withLinks = true }) => (
    <>
        <UploadField
            id={`${idPrefix}-fichiers`}
            files={form.fichiers}
            onChange={(fichiers) => setForm({ ...form, fichiers })}
        />
        {withLinks && <div className="salons-field-group">
            <label htmlFor={`${idPrefix}-liens`}>Liens (un par ligne)</label>
            <textarea
                id={`${idPrefix}-liens`}
                value={form.liens}
                onChange={(event) => setForm({ ...form, liens: event.target.value })}
                placeholder="https://exemple.com"
                rows="2"
            />
        </div>}
    </>
);

/** Heure d'ouverture facultative : avant, seul le créateur peut entrer. */
export const OpeningField = ({ id, value, onChange }) => (
    <div className="salons-field-group">
        <label htmlFor={id}>Heure d'ouverture (facultatif)</label>
        <input id={id} type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} />
        <small className="salon-field-hint">
            {value ? "Avant cette heure, personne n'entre dans le salon (sauf vous), même avec le lien d'invitation." : 'Laissez vide pour ouvrir le salon tout de suite.'}
        </small>
    </div>
);

export const VisibilityChoice = ({ value, onChange }) => (
    <div className="salon-visibility-choice" role="radiogroup" aria-label="Visibilité du salon">
        <button type="button" className={value === 'public' ? 'active' : ''} onClick={() => onChange('public')}>
            <FaGlobeAfrica /> Public
            <small>Tout le monde peut rejoindre</small>
        </button>
        <button type="button" className={value === 'prive' ? 'active' : ''} onClick={() => onChange('prive')}>
            <FaLock /> Privé
            <small>Sur invitation ou demande</small>
        </button>
    </div>
);

export const CreateSalonForm = ({ submitting, onSubmit, onError }) => {
    const emptyForm = { titre: '', description: '', visibilite: 'public', ouverture: '', ...emptyResources };
    const [form, setForm] = useState(emptyForm);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (form.titre.trim().length < 3) {
            onError('Le titre doit contenir au moins 3 caractères.');
            return;
        }
        // Les ressources sont facultatives à la création.
        const error = validateResources(form, { required: false });
        if (error) {
            onError(error);
            return;
        }
        const ok = await onSubmit(form);
        if (ok) setForm(emptyForm);
    };

    return (
        <form className="salons-form" onSubmit={handleSubmit}>
            <div className="salons-field-group">
                <label htmlFor="salon-titre">Titre du salon</label>
                <input
                    id="salon-titre"
                    type="text"
                    value={form.titre}
                    maxLength={255}
                    onChange={(event) => setForm({ ...form, titre: event.target.value })}
                    placeholder="Ex : Salon recherche"
                />
            </div>
            <div className="salons-field-group">
                <label htmlFor="salon-description">Description</label>
                <textarea
                    id="salon-description"
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    placeholder="Décrivez le sujet de discussion"
                    rows="3"
                />
            </div>
            <VisibilityChoice value={form.visibilite} onChange={(visibilite) => setForm({ ...form, visibilite })} />
            <OpeningField id="salon-ouverture" value={form.ouverture} onChange={(ouverture) => setForm({ ...form, ouverture })} />
            <ResourceFields idPrefix="salon" form={form} setForm={setForm} withLinks={false} />
            <div className="salons-form-footer">
                <span>{getResourceCount(form)} / {MAX_RESOURCES} ressources</span>
                <button type="submit" disabled={submitting}>{submitting ? 'Création…' : 'Créer'}</button>
            </div>
        </form>
    );
};

export const AddResourcesForm = ({ existing, submitting, onSubmit, onError }) => {
    const [form, setForm] = useState(emptyResources);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const error = validateResources(form, { existing });
        if (error) {
            onError(error);
            return;
        }
        const ok = await onSubmit(form);
        if (ok) setForm(emptyResources);
    };

    return (
        <form className="salons-form salon-resource-form" onSubmit={handleSubmit}>
            <ResourceFields idPrefix="salon-resource" form={form} setForm={setForm} />
            <div className="salons-form-footer">
                <span>{existing + getResourceCount(form)} / {MAX_RESOURCES} ressources</span>
                <button type="submit" disabled={submitting}>{submitting ? 'Ajout…' : 'Ajouter'}</button>
            </div>
        </form>
    );
};

export const EditSalonForm = ({ salon, submitting, onSubmit, onCancel }) => {
    const [form, setForm] = useState({
        titre: salon.titre || '',
        description: salon.description || '',
        visibilite: salon.visibilite || 'public',
        ouverture: toLocalInputValue(salon.date_ouverture)
    });

    return (
        <form className="salon-edit-form" onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}>
            <input value={form.titre} maxLength={255} onChange={(event) => setForm({ ...form, titre: event.target.value })} />
            <textarea value={form.description} rows="2" onChange={(event) => setForm({ ...form, description: event.target.value })} />
            <VisibilityChoice value={form.visibilite} onChange={(visibilite) => setForm({ ...form, visibilite })} />
            <OpeningField id="salon-edit-ouverture" value={form.ouverture} onChange={(ouverture) => setForm({ ...form, ouverture })} />
            <div>
                <button type="submit" disabled={submitting}>Enregistrer</button>
                <button type="button" onClick={onCancel}>Annuler</button>
            </div>
        </form>
    );
};
