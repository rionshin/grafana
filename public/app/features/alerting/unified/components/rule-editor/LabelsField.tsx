import { css, cx } from '@emotion/css';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { FieldArrayMethodProps, useFieldArray, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import {
  Button,
  Field,
  InlineLabel,
  Label,
  useStyles2,
  Text,
  Tooltip,
  Icon,
  Input,
  LoadingPlaceholder,
} from '@grafana/ui';
import { useDispatch } from 'app/types';

import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { fetchRulerRulesIfNotFetchedYet } from '../../state/actions';
import { RuleFormValues } from '../../types/rule-form';
import AlertLabelDropdown from '../AlertLabelDropdown';

interface Props {
  className?: string;
  dataSourceName?: string | null;
}

const useGetCustomLabels = (dataSourceName: string): { loading: boolean; labelsByKey: Record<string, Set<string>> } => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchRulerRulesIfNotFetchedYet(dataSourceName));
  }, [dispatch, dataSourceName]);

  const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
  const rulerRequest = rulerRuleRequests[dataSourceName];

  const labelsByKeyResult = useMemo<Record<string, Set<string>>>(() => {
    const labelsByKey: Record<string, Set<string>> = {};

    const rulerRulesConfig = rulerRequest?.result;
    if (!rulerRulesConfig) {
      return labelsByKey;
    }

    const allRules = Object.values(rulerRulesConfig)
      .flatMap((groups) => groups)
      .flatMap((group) => group.rules);

    allRules.forEach((rule) => {
      if (rule.labels) {
        Object.entries(rule.labels).forEach(([key, value]) => {
          if (!value) {
            return;
          }

          const labelEntry = labelsByKey[key];
          if (labelEntry) {
            labelEntry.add(value);
          } else {
            labelsByKey[key] = new Set([value]);
          }
        });
      }
    });

    return labelsByKey;
  }, [rulerRequest]);

  return { loading: rulerRequest?.loading, labelsByKey: labelsByKeyResult };
};

function mapLabelsToOptions(items: Iterable<string> = []): Array<SelectableValue<string>> {
  return Array.from(items, (item) => ({ label: item, value: item }));
}

const RemoveButton: FC<{
  remove: (index?: number | number[] | undefined) => void;
  className: string;
  index: number;
}> = ({ remove, className, index }) => (
  <Button
    className={className}
    aria-label="delete label"
    icon="trash-alt"
    data-testid={`delete-label-${index}`}
    variant="secondary"
    onClick={() => {
      remove(index);
    }}
  />
);

const AddButton: FC<{
  append: (
    value: Partial<{ key: string; value: string }> | Array<Partial<{ key: string; value: string }>>,
    options?: FieldArrayMethodProps | undefined
  ) => void;
  className: string;
}> = ({ append, className }) => (
  <Button
    className={className}
    icon="plus-circle"
    type="button"
    variant="secondary"
    onClick={() => {
      append({ key: '', value: '' });
    }}
  >
    Add label
  </Button>
);

const LabelsWithSuggestions: FC<{ dataSourceName: string }> = ({ dataSourceName }) => {
  const styles = useStyles2(getStyles);
  const {
    register,
    control,
    watch,
    formState: { errors },
    setValue,
  } = useFormContext<RuleFormValues>();

  const labels = watch('labels');
  const { fields, remove, append } = useFieldArray({ control, name: 'labels' });

  const { loading, labelsByKey } = useGetCustomLabels(dataSourceName);

  const [selectedKey, setSelectedKey] = useState('');

  const keys = useMemo(() => {
    return mapLabelsToOptions(Object.keys(labelsByKey));
  }, [labelsByKey]);

  const getValuesForLabel = useCallback(
    (key: string) => {
      return mapLabelsToOptions(labelsByKey[key]);
    },
    [labelsByKey]
  );

  const values = useMemo(() => {
    return getValuesForLabel(selectedKey);
  }, [selectedKey, getValuesForLabel]);

  return (
    <>
      {loading && <LoadingPlaceholder text="Loading" />}
      {!loading && (
        <Stack direction="column" gap={0.5}>
          {fields.map((field, index) => {
            return (
              <div key={field.id}>
                <div className={cx(styles.flexRow, styles.centerAlignRow)}>
                  <Field
                    className={styles.labelInput}
                    invalid={Boolean(errors.labels?.[index]?.key?.message)}
                    error={errors.labels?.[index]?.key?.message}
                    data-testid={`label-key-${index}`}
                  >
                    <AlertLabelDropdown
                      {...register(`labels.${index}.key`, {
                        required: { value: Boolean(labels[index]?.value), message: 'Required.' },
                      })}
                      defaultValue={field.key ? { label: field.key, value: field.key } : undefined}
                      options={keys}
                      onChange={(newValue: SelectableValue) => {
                        setValue(`labels.${index}.key`, newValue.value);
                        setSelectedKey(newValue.value);
                      }}
                      type="key"
                    />
                  </Field>
                  <InlineLabel className={styles.equalSign}>=</InlineLabel>
                  <Field
                    className={styles.labelInput}
                    invalid={Boolean(errors.labels?.[index]?.value?.message)}
                    error={errors.labels?.[index]?.value?.message}
                    data-testid={`label-value-${index}`}
                  >
                    <AlertLabelDropdown
                      {...register(`labels.${index}.value`, {
                        required: { value: Boolean(labels[index]?.key), message: 'Required.' },
                      })}
                      defaultValue={field.value ? { label: field.value, value: field.value } : undefined}
                      options={values}
                      onChange={(newValue: SelectableValue) => {
                        setValue(`labels.${index}.value`, newValue.value);
                      }}
                      onOpenMenu={() => {
                        setSelectedKey(labels[index].key);
                      }}
                      type="value"
                    />
                  </Field>

                  <RemoveButton className={styles.deleteLabelButton} index={index} remove={remove} />
                </div>
              </div>
            );
          })}
          <AddButton className={styles.addLabelButton} append={append} />
        </Stack>
      )}
    </>
  );
};

const LabelsWithoutSuggestions: FC = () => {
  const styles = useStyles2(getStyles);
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  const labels = watch('labels');
  const { fields, remove, append } = useFieldArray({ control, name: 'labels' });

  return (
    <>
      {fields.map((field, index) => {
        return (
          <div key={field.id}>
            <div className={cx(styles.flexRow, styles.centerAlignRow)} data-testid="alertlabel-input-wrapper">
              <Field
                className={styles.labelInput}
                invalid={!!errors.labels?.[index]?.key?.message}
                error={errors.labels?.[index]?.key?.message}
              >
                <Input
                  {...register(`labels.${index}.key`, {
                    required: { value: !!labels[index]?.value, message: 'Required.' },
                  })}
                  placeholder="key"
                  data-testid={`label-key-${index}`}
                  defaultValue={field.key}
                />
              </Field>
              <InlineLabel className={styles.equalSign}>=</InlineLabel>
              <Field
                className={styles.labelInput}
                invalid={!!errors.labels?.[index]?.value?.message}
                error={errors.labels?.[index]?.value?.message}
              >
                <Input
                  {...register(`labels.${index}.value`, {
                    required: { value: !!labels[index]?.key, message: 'Required.' },
                  })}
                  placeholder="value"
                  data-testid={`label-value-${index}`}
                  defaultValue={field.value}
                />
              </Field>
              <RemoveButton className={styles.deleteLabelButton} index={index} remove={remove} />
            </div>
          </div>
        );
      })}
      <AddButton className={styles.addLabelButton} append={append} />
    </>
  );
};

const LabelsField: FC<Props> = ({ dataSourceName }) => {
  const styles = useStyles2(getStyles);

  return (
    <div>
      <Label description="A set of default labels is automatically added. Add additional labels as required.">
        <Stack gap={0.5} alignItems="center">
          <Text variant="bodySmall" color="primary">
            Labels
          </Text>
          <Tooltip
            content={
              <div>
                The dropdown only displays labels that you have previously used for alerts. Select a label from the
                dropdown or type in a new one.
              </div>
            }
          >
            <Icon className={styles.icon} name="info-circle" size="sm" />
          </Tooltip>
        </Stack>
      </Label>
      {dataSourceName ? <LabelsWithSuggestions dataSourceName={dataSourceName} /> : <LabelsWithoutSuggestions />}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    icon: css`
      margin-right: ${theme.spacing(0.5)};
    `,
    flexColumn: css`
      display: flex;
      flex-direction: column;
    `,
    flexRow: css`
      display: flex;
      flex-direction: row;
      justify-content: flex-start;

      & + button {
        margin-left: ${theme.spacing(0.5)};
      }
    `,
    deleteLabelButton: css`
      margin-left: ${theme.spacing(0.5)};
      align-self: flex-start;
    `,
    addLabelButton: css`
      flex-grow: 0;
      align-self: flex-start;
    `,
    centerAlignRow: css`
      align-items: baseline;
    `,
    equalSign: css`
      align-self: flex-start;
      width: 28px;
      justify-content: center;
      margin-left: ${theme.spacing(0.5)};
    `,
    labelInput: css`
      width: 175px;
      margin-bottom: -${theme.spacing(1)};

      & + & {
        margin-left: ${theme.spacing(1)};
      }
    `,
  };
};

export default LabelsField;
