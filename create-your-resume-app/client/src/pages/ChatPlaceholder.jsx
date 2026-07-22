import { useParams } from 'react-router-dom';
import OrbitTracker from '../components/OrbitTracker';

export default function ChatPlaceholder() {
  const { id } = useParams();

  return (
    <div className="wrap">
      <h1 className="display">Create Your Resume</h1>
      <p className="sub">Intake pipeline, internal tool</p>

      <OrbitTracker activeStage="chat" />

      <div className="panel-card">
        <p style={{ color: 'var(--muted)' }}>
          Client #{id} was created. The chat screen isn't built yet, this is a placeholder so the
          Input screen has somewhere real to navigate to.
        </p>
      </div>
    </div>
  );
}
