/**
 * PDF Export Utility
 *
 * Exports tolerance stack analysis to a PDF report using jsPDF.
 */

import jsPDF from 'jspdf';
import { ProjectData, Direction, RSSResult } from '../types';
import { calculateTolerance } from './rssCalculator';

/**
 * Export project data to a PDF report
 */
export async function exportToPDF(
  projectData: ProjectData,
  filename: string = 'tolerance-analysis.pdf'
): Promise<void> {
  const doc = new jsPDF();
  const unit = projectData.unit || 'mm';
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let y = margin;

  // Helper function to add a new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (y + requiredSpace > pageHeight - margin) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  const title = projectData.metadata?.projectName || 'RSS Tolerance Analysis';
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Subtitle
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, y, { align: 'center' });
  y += 15;

  // Project Metadata Section
  if (projectData.metadata) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Project Information', margin, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const metadata = projectData.metadata;
    const metadataLines = [
      metadata.description && `Description: ${metadata.description}`,
      metadata.author && `Author: ${metadata.author}`,
      metadata.drawingNumber && `Drawing Number: ${metadata.drawingNumber}`,
      metadata.revision && `Revision: ${metadata.revision}`,
      `Units: ${unit}`,
      `Tolerance Mode: ${projectData.toleranceMode === 'symmetric' ? 'Symmetric (±)' : 'Asymmetric (+/-)'}`,
      `Calculation Mode: ${projectData.analysisSettings?.calculationMode || 'RSS'}`,
    ].filter(Boolean);

    metadataLines.forEach((line) => {
      if (line) {
        doc.text(line, margin, y);
        y += 5;
      }
    });
    y += 10;
  }

  // Tolerance Stacks
  projectData.directions.forEach((direction, dirIndex) => {
    checkPageBreak(50);

    // Direction Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${dirIndex + 1}. ${direction.name}`, margin, y);
    y += 7;

    if (direction.description) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text(direction.description, margin, y);
      y += 7;
    }

    // Direction limits
    if (direction.usl !== undefined || direction.lsl !== undefined) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const limits = [];
      if (direction.usl !== undefined) limits.push(`USL: ${direction.usl.toFixed(4)} ${unit}`);
      if (direction.lsl !== undefined) limits.push(`LSL: ${direction.lsl.toFixed(4)} ${unit}`);
      doc.text(`Specification Limits: ${limits.join(', ')}`, margin, y);
      y += 7;
    }

    y += 3;

    // Items Table Header
    const colWidths = projectData.toleranceMode === 'symmetric'
      ? [60, 25, 30, 25, 30]  // Name, Nominal, Tolerance, Float, Contribution
      : [50, 20, 25, 25, 20, 30];  // Name, Nominal, Tol+, Tol-, Float, Contribution

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');

    let x = margin;
    const headers = projectData.toleranceMode === 'symmetric'
      ? ['Item Name', 'Nominal', 'Tol (±)', 'Float', 'Contrib.']
      : ['Item Name', 'Nom.', 'Tol (+)', 'Tol (-)', 'Float', 'Contrib.'];

    headers.forEach((header, i) => {
      doc.text(header, x, y);
      x += colWidths[i];
    });
    y += 5;

    // Draw header line
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 3;

    // Calculate RSS for this direction
    const rssResult = direction.items.length > 0
      ? calculateTolerance(
          direction.items,
          direction.id,
          direction.name,
          projectData.analysisSettings?.calculationMode || 'rss'
        )
      : null;

    // Items
    doc.setFont('helvetica', 'normal');
    direction.items.forEach((item) => {
      checkPageBreak(10);

      const floatFactor = item.floatFactor || 1.0;
      const isFloat = floatFactor > 1.5;
      const contribution = item.tolerancePlus * floatFactor;

      x = margin;
      const values = projectData.toleranceMode === 'symmetric'
        ? [
            item.name.substring(0, 25), // Truncate long names
            (item.nominal ?? 0).toFixed(3),
            item.tolerancePlus.toFixed(4),
            isFloat ? '√3' : '1.0',
            contribution.toFixed(4),
          ]
        : [
            item.name.substring(0, 20),
            (item.nominal ?? 0).toFixed(2),
            item.tolerancePlus.toFixed(3),
            item.toleranceMinus.toFixed(3),
            isFloat ? '√3' : '1.0',
            contribution.toFixed(3),
          ];

      values.forEach((val, i) => {
        doc.text(val, x, y);
        x += colWidths[i];
      });
      y += 5;
    });

    // Draw line before totals
    y += 2;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // RSS Result
    if (rssResult) {
      doc.setFont('helvetica', 'bold');

      const mode = projectData.analysisSettings?.calculationMode || 'rss';
      const resultLabel = mode === 'rss' ? 'RSS Total:' : 'Worst-Case Total:';

      if (projectData.toleranceMode === 'symmetric') {
        doc.text(`${resultLabel} ±${rssResult.totalPlus.toFixed(4)} ${unit}`, margin, y);
      } else {
        doc.text(
          `${resultLabel} +${rssResult.totalPlus.toFixed(4)} / -${rssResult.totalMinus.toFixed(4)} ${unit}`,
          margin,
          y
        );
      }
      y += 6;

      // Show comparison if RSS mode
      if (mode === 'rss' && rssResult.worstCasePlus) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const savings = rssResult.worstCasePlus - rssResult.totalPlus;
        const savingsPercent = (savings / rssResult.worstCasePlus) * 100;
        doc.text(
          `Worst-Case: ±${rssResult.worstCasePlus.toFixed(4)} ${unit} | RSS Savings: ${savings.toFixed(4)} ${unit} (${savingsPercent.toFixed(1)}%)`,
          margin,
          y
        );
        y += 6;
      }

      // Specification status
      if (direction.usl !== undefined) {
        const utilization = (rssResult.totalPlus / direction.usl) * 100;
        doc.setFontSize(9);
        const status = utilization > 100 ? 'FAIL' : utilization > 90 ? 'WARNING' : 'PASS';
        doc.text(`USL Utilization: ${utilization.toFixed(1)}% (${status})`, margin, y);
        y += 5;
      }
    }

    y += 15; // Space between directions
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.text(
      'Generated by RSS Tolerance Stack Calculator',
      pageWidth - margin,
      pageHeight - 10,
      { align: 'right' }
    );
  }

  // Save the PDF
  doc.save(filename);
}

/**
 * Export a single direction to PDF (simpler format)
 */
export async function exportDirectionToPDF(
  direction: Direction,
  projectData: ProjectData,
  _rssResult: RSSResult | null, // Result is recalculated in exportToPDF
  filename?: string
): Promise<void> {
  const singleDirectionProject: ProjectData = {
    ...projectData,
    directions: [direction],
  };

  await exportToPDF(
    singleDirectionProject,
    filename || `${direction.name.replace(/\s+/g, '-').toLowerCase()}-analysis.pdf`
  );
}
