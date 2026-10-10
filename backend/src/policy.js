// Internal policy-selection layer. Admins do not choose OS algorithms.
export function selectAlgorithm(resourceType, { priority = 3 } = {}) {
  if (resourceType === 'PRINTING') return 'SJF';
  if (resourceType === 'LIBRARY') return 'FCFS';
  if (resourceType === 'CANTEEN') return 'FCFS';
  if (resourceType === 'LAB') return priority <= 2 ? 'PRIORITY' : 'FCFS';
  return 'FCFS';
}
