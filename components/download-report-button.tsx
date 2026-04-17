"use client";

export function DownloadReportButton() {
  function onDownload() {
    window.print();
  }

  return (
    <button type="button" onClick={onDownload} className="btn-primary">
      Download PDF Report
    </button>
  );
}