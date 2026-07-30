import ReactMarkdown from 'react-markdown';
import privacyContent from '../../Murmur-Privacy-Policy.md?raw';
import './LegalPage.css';

function PrivacyPolicyPage() {
  return (
    <div className="legal-page animate-fade-in">
      <div className="legal-container glass">
        <ReactMarkdown>{privacyContent}</ReactMarkdown>
      </div>
    </div>
  );
}

export default PrivacyPolicyPage;
