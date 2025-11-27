import type { StateFieldMetadata, SerializedWorkflowState } from '../types/index.js';

/**
 * WeakMap storing field metadata keyed by class prototype
 * Structure: Map<propertyKey, StateFieldMetadata>
 */
const OBSERVED_STATE_FIELDS = new WeakMap<object, Map<string, StateFieldMetadata>>();

/**
 * @ObservedState decorator
 * Marks a class field for inclusion in state snapshots
 *
 * @example
 * class MyWorkflow extends Workflow {
 *   @ObservedState()
 *   currentStep!: string;
 *
 *   @ObservedState({ redact: true })
 *   sensitiveData!: string;
 *
 *   @ObservedState({ hidden: true })
 *   internalState!: object;
 * }
 */
export function ObservedState(meta: StateFieldMetadata = {}) {
  return function (
    _value: undefined,
    context: ClassFieldDecoratorContext
  ): void {
    const propertyKey = String(context.name);

    // Use addInitializer to register field when class is instantiated
    context.addInitializer(function (this: unknown) {
      const instance = this as object;
      const proto = Object.getPrototypeOf(instance);
      let map = OBSERVED_STATE_FIELDS.get(proto);
      if (!map) {
        map = new Map();
        OBSERVED_STATE_FIELDS.set(proto, map);
      }
      map.set(propertyKey, meta);
    });
  };
}

/**
 * Get all observed state from an object instance
 * Applies hidden and redact transformations
 */
export function getObservedState(obj: object): SerializedWorkflowState {
  const proto = Object.getPrototypeOf(obj);
  const map = OBSERVED_STATE_FIELDS.get(proto);

  if (!map) {
    return {};
  }

  const result: SerializedWorkflowState = {};

  for (const [key, meta] of map) {
    // Skip hidden fields
    if (meta.hidden) {
      continue;
    }

    let value = (obj as Record<string, unknown>)[key];

    // Redact sensitive fields
    if (meta.redact) {
      value = '***';
    }

    result[key] = value;
  }

  return result;
}

/**
 * Check if a field is observed on an object
 */
export function isFieldObserved(obj: object, fieldName: string): boolean {
  const proto = Object.getPrototypeOf(obj);
  const map = OBSERVED_STATE_FIELDS.get(proto);
  return map?.has(fieldName) ?? false;
}

/**
 * Get metadata for a specific field
 */
export function getFieldMetadata(obj: object, fieldName: string): StateFieldMetadata | undefined {
  const proto = Object.getPrototypeOf(obj);
  const map = OBSERVED_STATE_FIELDS.get(proto);
  return map?.get(fieldName);
}
