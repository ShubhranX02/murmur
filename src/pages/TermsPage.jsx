import ReactMarkdown from 'react-markdown';
import termsContent from '../../Murmur-Terms-and-Conditions.md?raw';
import './LegalPage.css';

function TermsPage() {
  return (
    <div className="legal-page animate-fade-in">
      <div className="legal-container glass">
        <ReactMarkdown>{termsContent}</ReactMarkdown>
      </div>
    </div>
  );
}

export default TermsPage;
