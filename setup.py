from distutils.core import setup

setup(
    name="joblog",
    version="1.0.1",
    description="Standardized logging for batch jobs and others.",
    long_description=open("README.md").read(),
    author="James Bursa",
    author_email="james@zamez.org",
    url="https://github.com/jamesbursa/joblog",
    py_modules=["joblog",],
    license="MIT",
)
