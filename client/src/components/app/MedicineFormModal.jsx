import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastProvider';
import { useWorkspace } from '../../context/WorkspaceProvider';
import { Modal } from '../ui/Overlay';
import { Button } from '../ui/Button';
import { Input, Select, Textarea, Checkbox } from '../ui/Field';
import { Notice } from '../ui/Feedback';
import { MedicineNameInput } from './MedicineNameInput';
import { MEDICINE_FORMS, cx, dayjs } from '../../lib/format';

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Split a catalog strength string into strength + unit when the unit is written
 * out (e.g. "100 mcg" → { strength: "100", unit: "mcg" }). When it is not, the
 * strength is kept verbatim and the existing unit is left untouched.
 */
function splitStrength(raw) {
  const match = String(raw || '').match(/^([\d.]+(?:\/[\d.]+)?)\s*(mg|mcg|g|ml|IU|%)$/i);
  if (!match) return { strength: raw || '', unit: null };
  return { strength: match[1], unit: match[2] };
}

const schema = z
  .object({
    profileId: z.string().min(1, 'Choose who this medicine is for'),
    name: z.string().trim().min(1, 'Enter the medicine name').max(200),
    strength: z.string().trim().max(60).optional().default(''),
    unit: z.string().trim().max(30).optional().default('mg'),
    form: z.string().min(1),
    instructions: z.string().max(1000).optional().default(''),
    scheduleType: z.enum(['daily', 'weekdays', 'interval', 'specific-dates', 'as-needed']),
    times: z
      .array(z.object({ value: z.string().regex(timePattern, 'Use HH:mm') }))
      .default([]),
    weekdays: z.array(z.number()).default([]),
    intervalDays: z.coerce.number().int().min(1).max(365).default(2),
    specificDates: z.array(z.object({ value: z.string() })).default([]),
    doseQuantity: z.coerce.number().min(0).max(1000).default(1),
    startDate: z.string().min(1, 'Choose a start date'),
    endDate: z.string().optional().default(''),
    stockQuantity: z.coerce.number().min(0).max(1000000).default(0),
    stockUnit: z.string().trim().max(30).default('tablets'),
    lowStockThreshold: z.coerce.number().min(0).max(1000000).default(5),
    expiryDate: z.string().optional().default(''),
    manufacturer: z.string().trim().max(160).optional().default(''),
    batchNumber: z.string().trim().max(80).optional().default(''),
    status: z.enum(['active', 'paused', 'finished', 'archived']).default('active'),
  })
  .superRefine((data, ctx) => {
    if (data.scheduleType !== 'as-needed' && data.times.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['times'],
        message: 'Add at least one time, or choose "Only when needed".',
      });
    }
    if (data.scheduleType === 'weekdays' && data.weekdays.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weekdays'],
        message: 'Pick at least one day of the week.',
      });
    }
    if (data.scheduleType === 'specific-dates' && data.specificDates.filter((d) => d.value).length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['specificDates'], message: 'Add at least one date.' });
    }
  });

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

export function MedicineFormModal({ open, onClose, medicine = null, defaultProfileId = null }) {
  const { profiles } = useWorkspace();
  const client = useQueryClient();
  const toast = useToast();
  const isEdit = Boolean(medicine);

  const initial = useMemo(() => {
    if (medicine) {
      return {
        profileId: medicine.profileId?.id || medicine.profileId || '',
        name: medicine.name || '',
        strength: medicine.strength || '',
        unit: medicine.unit || 'mg',
        form: medicine.form || 'tablet',
        instructions: medicine.instructions || '',
        scheduleType: medicine.schedule?.type || 'daily',
        times: (medicine.schedule?.times || []).map((value) => ({ value })),
        weekdays: medicine.schedule?.weekdays || [],
        intervalDays: medicine.schedule?.intervalDays || 2,
        specificDates: (medicine.schedule?.specificDates || []).map((value) => ({ value })),
        doseQuantity: medicine.schedule?.doseQuantity ?? 1,
        startDate: medicine.startDate ? dayjs(medicine.startDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        endDate: medicine.endDate ? dayjs(medicine.endDate).format('YYYY-MM-DD') : '',
        stockQuantity: medicine.stock?.quantity ?? 0,
        stockUnit: medicine.stock?.unit || 'tablets',
        lowStockThreshold: medicine.stock?.lowStockThreshold ?? 5,
        expiryDate: medicine.expiryDate ? dayjs(medicine.expiryDate).format('YYYY-MM-DD') : '',
        manufacturer: medicine.manufacturer || '',
        batchNumber: medicine.batchNumber || '',
        status: medicine.status || 'active',
      };
    }
    return {
      profileId: defaultProfileId || profiles[0]?.id || '',
      name: '',
      strength: '',
      unit: 'mg',
      form: 'tablet',
      instructions: '',
      scheduleType: 'daily',
      times: [{ value: '09:00' }],
      weekdays: [],
      intervalDays: 2,
      specificDates: [],
      doseQuantity: 1,
      startDate: dayjs().format('YYYY-MM-DD'),
      endDate: '',
      stockQuantity: 0,
      stockUnit: 'tablets',
      lowStockThreshold: 5,
      expiryDate: '',
      manufacturer: '',
      batchNumber: '',
      status: 'active',
    };
  }, [medicine, defaultProfileId, profiles]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: initial });

  useEffect(() => {
    if (open) reset(initial);
  }, [open, initial, reset]);

  const timesArray = useFieldArray({ control, name: 'times' });
  const datesArray = useFieldArray({ control, name: 'specificDates' });

  const scheduleType = watch('scheduleType');
  const selectedWeekdays = watch('weekdays') || [];

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEdit ? api.patch(`/medicines/${medicine.id}`, payload) : api.post('/medicines', payload),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['medicines'] });
      client.invalidateQueries({ queryKey: ['doses'] });
      client.invalidateQueries({ queryKey: ['dashboard'] });
      client.invalidateQueries({ queryKey: ['stock'] });
      toast.success(isEdit ? 'Medicine updated.' : 'Medicine added.');
      onClose?.();
    },
    onError: (error) => {
      toast.error(error.message);
      if (Array.isArray(error.details)) {
        toast.error(error.details.map((d) => `${d.path}: ${d.message}`).join(', '));
      }
    },
  });

  const onSubmit = (values) => {
    const payload = {
      name: values.name,
      strength: values.strength || '',
      unit: values.unit || 'mg',
      form: values.form,
      instructions: values.instructions || '',
      schedule: {
        type: values.scheduleType,
        times: values.scheduleType === 'as-needed' ? [] : values.times.map((t) => t.value).filter(Boolean),
        weekdays: values.scheduleType === 'weekdays' ? values.weekdays : [],
        intervalDays: values.scheduleType === 'interval' ? values.intervalDays : 1,
        specificDates:
          values.scheduleType === 'specific-dates'
            ? values.specificDates.map((d) => d.value).filter(Boolean)
            : [],
        doseQuantity: values.doseQuantity,
      },
      startDate: values.startDate,
      endDate: values.endDate || null,
      stock: {
        quantity: values.stockQuantity,
        unit: values.stockUnit || 'tablets',
        lowStockThreshold: values.lowStockThreshold,
      },
      expiryDate: values.expiryDate || null,
      manufacturer: values.manufacturer || '',
      batchNumber: values.batchNumber || '',
      status: values.status,
    };

    if (isEdit) {
      delete payload.profileId;
      mutation.mutate(payload);
    } else {
      mutation.mutate({ ...payload, profileId: values.profileId, source: 'manual' });
    }
  };

  const toggleWeekday = (value) => {
    const next = selectedWeekdays.includes(value)
      ? selectedWeekdays.filter((d) => d !== value)
      : [...selectedWeekdays, value].sort();
    setValue('weekdays', next, { shouldValidate: true });
  };

  /**
   * Populate fields from a chosen autocomplete suggestion. Only verified fields
   * from the catalog are filled — nothing is invented, and a manufacturer is
   * only set when the catalog actually carries one.
   */
  const applyCatalogSuggestion = (entry) => {
    if (!entry) return;
    setValue('name', entry.brandName || '', { shouldValidate: true, shouldDirty: true });
    const { strength, unit } = splitStrength(entry.strength);
    if (strength) setValue('strength', strength, { shouldDirty: true, shouldValidate: true });
    if (unit) setValue('unit', unit, { shouldDirty: true });
    if (entry.form) setValue('form', entry.form, { shouldDirty: true });
    if (entry.manufacturer) setValue('manufacturer', entry.manufacturer, { shouldDirty: true });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `Edit ${medicine?.name}` : 'Add a medicine'}
      description={
        isEdit
          ? 'Changes to the schedule update the upcoming doses. Stock history is never rewritten.'
          : 'Enter the medicine details yourself. Start typing the name to pick a match from the reference list.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={mutation.isPending}>
            {isEdit ? 'Save changes' : 'Add medicine'}
          </Button>
        </>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        {!isEdit ? (
          <Select label="Who is this for?" required error={errors.profileId?.message} {...register('profileId')}>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} ({profile.relationship})
              </option>
            ))}
          </Select>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <MedicineNameInput
            value={watch('name') || ''}
            onChange={(next) => setValue('name', next, { shouldValidate: true, shouldDirty: true })}
            onSelect={applyCatalogSuggestion}
            error={errors.name?.message}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Strength" placeholder="500" error={errors.strength?.message} {...register('strength')} />
            <Input label="Unit" placeholder="mg" error={errors.unit?.message} {...register('unit')} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Form" error={errors.form?.message} {...register('form')}>
            {MEDICINE_FORMS.map((form) => (
              <option key={form} value={form}>
                {form[0].toUpperCase() + form.slice(1)}
              </option>
            ))}
          </Select>
          <Input
            label="How many units per dose"
            type="number"
            step="0.5"
            min="0"
            error={errors.doseQuantity?.message}
            {...register('doseQuantity')}
          />
        </div>

        <Textarea
          label="Instructions from the label or prescription"
          placeholder="e.g. Take one tablet with food"
          rows={2}
          error={errors.instructions?.message}
          {...register('instructions')}
        />
        <p className="-mt-3 hint">
          MediTrack stores the instructions you enter. It never invents a dose or changes one on its own.
        </p>

        {/* ------------------------------ schedule ------------------------------ */}
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-1.5 text-sm font-semibold text-content">Schedule</legend>

          <Select label="Pattern" {...register('scheduleType')}>
            <option value="daily">Every day</option>
            <option value="weekdays">Selected days of the week</option>
            <option value="interval">Every N days</option>
            <option value="specific-dates">Specific dates</option>
            <option value="as-needed">Only when needed</option>
          </Select>

          {scheduleType === 'weekdays' ? (
            <div className="mt-4">
              <p className="label">Days</p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => {
                  const active = selectedWeekdays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleWeekday(day.value)}
                      aria-pressed={active}
                      className={cx(
                        'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                        active
                          ? 'border-transparent bg-accent-soft text-accent'
                          : 'border-border text-muted hover:bg-surface-2 hover:text-content',
                      )}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              {errors.weekdays?.message ? (
                <p role="alert" className="mt-2 text-xs text-danger">
                  {errors.weekdays.message}
                </p>
              ) : null}
            </div>
          ) : null}

          {scheduleType === 'interval' ? (
            <div className="mt-4">
              <Input
                label="Repeat every (days)"
                type="number"
                min="1"
                max="365"
                error={errors.intervalDays?.message}
                {...register('intervalDays')}
              />
            </div>
          ) : null}

          {scheduleType === 'specific-dates' ? (
            <div className="mt-4 space-y-2">
              <p className="label">Dates</p>
              {datesArray.fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <input type="date" className="field" {...register(`specificDates.${index}.value`)} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove date"
                    onClick={() => datesArray.remove(index)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={() => datesArray.append({ value: '' })}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add date
              </Button>
              {errors.specificDates?.message ? (
                <p role="alert" className="text-xs text-danger">
                  {errors.specificDates.message}
                </p>
              ) : null}
            </div>
          ) : null}

          {scheduleType !== 'as-needed' && scheduleType !== 'specific-dates' ? (
            <div className="mt-4 space-y-2">
              <p className="label">Times</p>
              {timesArray.fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <input type="time" className="field" {...register(`times.${index}.value`)} />
                  {timesArray.fields.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove time"
                      onClick={() => timesArray.remove(index)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={() => timesArray.append({ value: '12:00' })}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add time
              </Button>
              {errors.times?.message ? (
                <p role="alert" className="text-xs text-danger">
                  {errors.times.message}
                </p>
              ) : null}
              <p className="hint">Times use the timezone on your account.</p>
            </div>
          ) : null}

          {scheduleType === 'as-needed' ? (
            <Notice tone="neutral" className="mt-4">
              No reminders are generated for this medicine. Record doses yourself when you take them.
            </Notice>
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label="Start date" type="date" required error={errors.startDate?.message} {...register('startDate')} />
            <Input label="End date (optional)" type="date" error={errors.endDate?.message} {...register('endDate')} />
          </div>
        </fieldset>

        {/* -------------------------------- stock ------------------------------- */}
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-1.5 text-sm font-semibold text-content">Stock &amp; expiry</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Quantity on hand"
              type="number"
              step="0.5"
              min="0"
              error={errors.stockQuantity?.message}
              {...register('stockQuantity')}
            />
            <Input label="Stock unit" placeholder="tablets" error={errors.stockUnit?.message} {...register('stockUnit')} />
            <Input
              label="Low-stock alert at"
              type="number"
              step="0.5"
              min="0"
              error={errors.lowStockThreshold?.message}
              {...register('lowStockThreshold')}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Input label="Expiry date (optional)" type="date" error={errors.expiryDate?.message} {...register('expiryDate')} />
            <Input label="Manufacturer (optional)" error={errors.manufacturer?.message} {...register('manufacturer')} />
            <Input label="Batch number (optional)" error={errors.batchNumber?.message} {...register('batchNumber')} />
          </div>
          <p className="hint mt-2">
            Leave the expiry date blank rather than guessing — MediTrack will keep it empty until you know it.
          </p>
        </fieldset>

        {isEdit ? (
          <Select label="Status" hint="Paused and finished medicines stop generating reminders. Archived medicines are hidden from the main list." {...register('status')}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="finished">Finished</option>
            <option value="archived">Archived</option>
          </Select>
        ) : null}

        {isEdit ? (
          <Notice tone="neutral" icon={RefreshCw}>
            Saving recalculates upcoming doses. Past dose history and the stock ledger are never modified.
          </Notice>
        ) : null}

        <Checkbox
          label="I have checked this against the prescription or packaging."
          defaultChecked={false}
          hint="MediTrack records what you enter. It is not a substitute for professional advice."
        />
      </form>
    </Modal>
  );
}

export default MedicineFormModal;
