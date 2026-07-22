const STAGES = [
  { key: 'input', label: 'Input' },
  { key: 'chat', label: 'Chat' },
  { key: 'checklist', label: 'Checklist' },
  { key: 'link', label: 'Link' },
  { key: 'results', label: 'Results' },
  { key: 'output', label: 'Output' }
];

export default function OrbitTracker({ activeStage }) {
  const activeIndex = STAGES.findIndex((s) => s.key === activeStage);

  return (
    <div className="orbit-wrap">
      <div className="orbit-path" />
      <div className="orbit-stages">
        {STAGES.map((stage, i) => {
          let className = 'stage';
          if (i < activeIndex) className += ' done';
          if (i === activeIndex) className += ' active';
          return (
            <div className={className} key={stage.key}>
              <div className="dot" />
              <div className="label">{stage.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
