export interface ProficiencyLevel {
    value: number | null;
    label: string;
    description: string;
}

export const PROFICIENCY_SCALE: Record<string, ProficiencyLevel> = {
    unrated: {
        value: null,
        label: 'Not rated',
        description: 'I have not assessed this skill yet.',
    },
    '0': {
        value: 0,
        label: 'No experience',
        description: 'I have not performed this activity.',
    },
    '1': {
        value: 1,
        label: 'With guidance',
        description: 'I can perform this activity with assistance or guidance.',
    },
    '2': {
        value: 2,
        label: 'Independent',
        description: 'I can perform routine activities independently.',
    },
    '3': {
        value: 3,
        label: 'Advanced',
        description: 'I can perform complex activities independently, although some corrections may be needed.',
    },
    '4': {
        value: 4,
        label: 'Highly proficient',
        description: 'I can consistently perform complex activities independently with little or no correction needed.',
    },
};

export interface SkillItem {
    id: number;
    category_id: number;
    code: string;
    name: string;
    statement: string;
    display_order: number;
    user_rating: number | null;
}

export interface SkillCategoryItem {
    id: number;
    name: string;
    display_order: number;
    skills: SkillItem[];
}

export interface SkillProfileData {
    categories: SkillCategoryItem[];
    total_skills: number;
    rated_count: number;
    is_completed: boolean;
    is_acknowledged: boolean;
    skill_onboarding_acknowledged_at: string | null;
    skill_assessment_completed_at: string | null;
}
