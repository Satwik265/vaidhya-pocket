import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DepartmentSelectionStep } from '../components/kiosk/DepartmentSelectionStep';

describe('DepartmentSelectionStep & AYUSH Mode', () => {
  it('renders both Allopathic and Ayurveda department choices clearly', () => {
    const handleSelect = vi.fn();
    render(
      <DepartmentSelectionStep
        selectedDepartment="Allopathic"
        onSelectDepartment={handleSelect}
      />
    );

    expect(screen.getByRole('heading', { name: /Allopathic Medicine/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Ayurveda \(AYUSH\)/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Dashavidha Pariksha/i).length).toBeGreaterThanOrEqual(1);
  });

  it('selects Ayurveda department and triggers onSelectDepartment callback', () => {
    const handleSelect = vi.fn();
    render(
      <DepartmentSelectionStep
        selectedDepartment="Allopathic"
        onSelectDepartment={handleSelect}
      />
    );

    // Click the Ayurveda card or its button
    const ayushSelectBtn = screen.getByText(/Select Ayurveda OPD/i);
    fireEvent.click(ayushSelectBtn);

    const continueBtn = screen.getByRole('button', { name: /Proceed to Ayurveda \(AYUSH\) Intake/i });
    fireEvent.click(continueBtn);

    expect(handleSelect).toHaveBeenCalledWith('Ayurveda (AYUSH)');
  });

  it('allows selecting Allopathic mode', () => {
    const handleSelect = vi.fn();
    render(
      <DepartmentSelectionStep
        selectedDepartment="Ayurveda (AYUSH)"
        onSelectDepartment={handleSelect}
      />
    );

    const allopathicSelectBtn = screen.getByText(/Select Allopathic OPD/i);
    fireEvent.click(allopathicSelectBtn);

    const continueBtn = screen.getByRole('button', { name: /Proceed to Allopathic Intake/i });
    fireEvent.click(continueBtn);

    expect(handleSelect).toHaveBeenCalledWith('Allopathic');
  });
});

