name: 🐞 Bug report
description: Create a detailed report to help us fix the issue
title: "[Bug]: "
labels: ["bug"]
assignees: []

body:
  - type: markdown
    attributes:
      value: |
        ## 🐛 Bug Report
        Please fill out the form below carefully. Fields marked with * are required.

  - type: input
    id: summary
    attributes:
      label: Bug Summary *
      description: A clear and concise title for the bug.
      placeholder: App crashes when opening settings
    validations:
      required: true

  - type: textarea
    id: description
    attributes:
      label: Describe the bug *
      description: A clear and concise description of what the bug is.
      placeholder: The app closes immediately when I try to open the settings page.
    validations:
      required: true

  - type: textarea
    id: steps_to_reproduce
    attributes:
      label: Steps to Reproduce *
      description: List all steps to reproduce the issue.
      placeholder: |
        1. Open the app
        2. Go to Settings
        3. Click on "Preferences"
        4. Observe the crash
    validations:
      required: true

  - type: textarea
    id: expected_behavior
    attributes:
      label: Expected Behavior *
      description: What did you expect to happen instead?
      placeholder: The settings page should open without crashing.
    validations:
      required: true

  - type: textarea
    id: screenshots
    attributes:
      label: Screenshots
      description: If applicable, add screenshots or screen recordings to explain the problem.
      placeholder: You can drag and drop images here.

  - type: dropdown
    id: os
    attributes:
      label: Operating System *
      description: Select your OS.
      options:
        - macOS
        - Windows
        - Linux
    validations:
      required: true

  - type: input
    id: os_version
    attributes:
      label: OS Version *
      description: Specify your OS version.
      placeholder: e.g., macOS 14.5 / Ubuntu 24.04 / Windows 11
    validations:
      required: true

  - type: input
    id: app_version
    attributes:
      label: App Version *
      description: The version of the app where the bug occurred.
      placeholder: e.g., 0.2.0
    validations:
      required: true

  - type: textarea
    id: logs
    attributes:
      label: Log Output
      description: If relevant, include error logs or console output.
      placeholder: Paste logs or terminal output here.

  - type: textarea
    id: additional_context
    attributes:
      label: Additional Context
      description: Add any other context or information about the problem here.
