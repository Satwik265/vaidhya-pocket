// PHASE1-POCKET
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PocketApp } from '../components/pocket/PocketApp';

describe('PocketApp (phone-first flow)', () => {
  it('runs the 6-step loop; export is locked until approval', async () => {
    render(<PocketApp />);
    fireEvent.change(screen.getByTestId('transcript-input'), { target: { value: 'Mujhe seene mein dard hai aur saans phoolti hai, do din se. Bukhar nahi hai.' } });
    fireEvent.click(screen.getByTestId('analyse-btn'));

    await waitFor(() => expect(screen.getByTestId('fact-list')).toBeInTheDocument());
    expect(screen.getAllByTestId('red-flag').length).toBeGreaterThan(0);
    expect(screen.getByTestId('soap-text').textContent).toContain('SOAP NOTE');

    expect(screen.getByTestId('export-locked')).toBeInTheDocument();
    expect((screen.getByTestId('export-fhir') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByText('Start review'));
    fireEvent.click(screen.getByTestId('approve-btn'));
    expect(screen.getByTestId('approval-state').textContent).toBe('APPROVED');
    expect((screen.getByTestId('export-fhir') as HTMLButtonElement).disabled).toBe(false);
  });

  it('demo model drops fabricated facts and shows the gated rate', async () => {
    render(<PocketApp />);
    fireEvent.change(screen.getByTestId('transcript-input'), { target: { value: 'Patient reports chest pain with shortness of breath for 2 days. No fever.' } });
    fireEvent.click(screen.getByTestId('analyse-btn'));
    await waitFor(() => screen.getByTestId('run-llm'));
    fireEvent.click(screen.getByTestId('run-llm'));
    await waitFor(() => expect(screen.getByTestId('gated-panel')).toBeInTheDocument());
    expect(screen.getByTestId('gated-panel').textContent).toMatch(/After gate:\s*0%/);
  });

  it('Device Proof panel shows bytes uploaded and Office Kit counters', () => {
    render(<PocketApp />);
    expect(screen.getByTestId('bytes-sent').textContent).toMatch(/B uploaded/);
    fireEvent.click(screen.getByTestId('device-proof-toggle'));
    expect(screen.getByTestId('office-counters').textContent).toBe('0 / 0 / 0');
  });
});
