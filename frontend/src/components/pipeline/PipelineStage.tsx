import {useEffect, useRef, type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight} from 'lucide-react';

export interface StageData {
  id: string;
  num: string;
  eyebrow: string;
  headline: string;
  headlineHighlight?: string;
  subHeadline?: string;
  description: string;
  tags?: string[];
  accentTags?: string[];
  cta?: {
    label: string;
    to: string;
  };
  evidenceStrip?: {
    tag: string;
    title: string;
    body: string;
  };
}

interface PipelineStageProps {
  stage: StageData;
  index: number;
  isActive: boolean;
  onIntersect: (index: number) => void;
  children?: ReactNode; // Rendered on mobile screens inline
}

export default function PipelineStage({
  stage,
  index,
  isActive,
  onIntersect,
  children,
}: PipelineStageProps) {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            onIntersect(index);
          }
        });
      },
      {
        rootMargin: '-30% 0px -40% 0px', // Active when stage is centered in viewport
        threshold: 0.1,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [index, onIntersect]);

  return (
    <div
      id={stage.id}
      ref={sectionRef}
      className={`pipeline-stage-item ${isActive ? 'is-active-stage' : ''}`}
      style={{opacity: isActive ? 1 : 0.65}}
    >
      <div className="stage-eyebrow">
        <span className="stage-dot" />
        <span>{stage.eyebrow}</span>
      </div>

      <h2>
        {stage.headline}{' '}
        {stage.headlineHighlight && <span className="highlight">{stage.headlineHighlight}</span>}
        {stage.subHeadline && <span className="sub-headline">{stage.subHeadline}</span>}
      </h2>

      <p className="stage-description">{stage.description}</p>

      {(stage.tags || stage.accentTags) && (
        <div className="stage-tags">
          {stage.accentTags?.map(tag => (
            <span key={tag} className="stage-tag accent">
              {tag}
            </span>
          ))}
          {stage.tags?.map(tag => (
            <span key={tag} className="stage-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {stage.evidenceStrip && (
        <div className="stage-evidence-strip">
          <span>{stage.evidenceStrip.tag}</span>
          <strong>{stage.evidenceStrip.title}</strong>
          <p>{stage.evidenceStrip.body}</p>
        </div>
      )}

      {stage.cta && (
        <div className="stage-cta-wrap">
          <Link to={stage.cta.to} className="stage-action-cta">
            {stage.cta.label} <ArrowRight size={15} />
          </Link>
        </div>
      )}

      {/* Rendered only on mobile screen widths via CSS */}
      <div className="mobile-stage-visual">{children}</div>
    </div>
  );
}
