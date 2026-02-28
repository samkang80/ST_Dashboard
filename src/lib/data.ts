import raw from '@/data/dashboardData.json';
import type { DashboardRow } from './types';

export const rows = raw.rows as DashboardRow[];
export const projectIds = raw.projectIds as string[];

export const groupedProjectIds = {
  P: projectIds.filter((id) => id.startsWith('P')),
  C: projectIds.filter((id) => id.startsWith('C')),
  PC: projectIds.filter((id) => id.startsWith('PC')),
};
