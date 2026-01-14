const CONFIG = {
    serviceID: "service_02a69lr",       // From EmailJS dashboard
    templateID: "template_9nyubey",     // From EmailJS dashboard
    publicKey: "bmXU3I-vGXm20wj_Q"        // From EmailJS dashboard
};

// Initialize EmailJS
emailjs.init(CONFIG.publicKey);

// Form submission handler
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('contactForm');
    const submitBtn = document.getElementById('submitBtn');

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

        // Get form data
        const formData = {
            name: document.getElementById('name').value,
            phone: document.getElementById('phone').value,
            message: document.getElementById('message').value,
            timing: document.getElementById('timing').value || 'Not specified',
            date: new Date().toLocaleString()
        };

        // Validate
        if (!formData.name || !formData.phone || !formData.message) {
            showMessage('Please fill in all required fields.', 'error');
            resetButton();
            return;
        }

        // Send email using EmailJS
        emailjs.send(CONFIG.serviceID, CONFIG.templateID, formData)
            .then(function() {
                showMessage('Thank you! Your message has been sent successfully. We will get back to you soon.', 'success');
                form.reset();
                resetButton();
            })
            .catch(function(error) {
                showMessage('Sorry, there was an error. Please try again or contact us via WhatsApp.', 'error');
                console.error('Error:', error);
                resetButton();
            });
    });

    function resetButton() {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Message';
    }

    function showMessage(message, type) {
        // Remove any existing messages
        const existingMsg = document.querySelector('.form-message');
        if (existingMsg) {
            existingMsg.remove();
        }

        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `form-message ${type}`;
        messageDiv.textContent = message;

        // Insert message before the form
        form.parentNode.insertBefore(messageDiv, form);

        // Auto-remove success message after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                messageDiv.style.opacity = '0';
                setTimeout(() => messageDiv.remove(), 300);
            }, 5000);
        }
    }
});
